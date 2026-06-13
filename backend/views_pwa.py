from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Count, Q


# ── Mapping Gruppo → catalog client_name ──────────────────────────
GRUPPO_TO_CATALOG = {
    "CEDIGROS": "Gros",
    "SUPER ELITE": "Elite",
    "PAC 2000": "Pac2000",
}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def agent_profile(request):
    user = request.user
    org = user.organization_set.first()
    return Response({
        "id": user.id,
        "username": user.username,
        "full_name": user.get_full_name() or user.username,
        "email": user.email,
        "phone": "",
        "organization": {
            "id": org.id,
            "name": org.Name,
            "logo_url": None,
        } if org else None,
        "enabled_modules": ["orders"],
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def catalog_suppliers(request):
    from pdf_upload.models import Fornitore
    from pdf_upload.models_pwa import Catalog
    org = request.user.organization_set.first()
    if not org:
        return Response([])

    supplier_ids = (
        Catalog.objects.filter(organization=org, is_active=True)
        .values_list("supplier_id", flat=True)
        .distinct()
    )
    suppliers = Fornitore.objects.filter(id__in=supplier_ids).order_by("Title")
    data = [
        {
            "id": s.id,
            "name": s.Title,
            "icon": "Package",
            "client_count": Catalog.objects.filter(
                organization=org, supplier=s, is_active=True
            ).count(),
        }
        for s in suppliers
    ]
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pv_search(request):
    """
    GET /api/pv/search/?q=DESA&supplier_id=2

    Search punti vendita by name, address, or city.
    Returns PV info + whether a catalog exists for this supplier+PV group.
    """
    from pdf_upload.models import Clienti
    from pdf_upload.models_pwa import Catalog

    org = request.user.organization_set.first()
    q = request.GET.get("q", "").strip()
    supplier_id = request.GET.get("supplier_id")

    if not q or len(q) < 2:
        return Response([])

    # Search by Title, Address, or City
    results = (
        Clienti.objects.filter(
            Q(Title__icontains=q) |
            Q(Address__icontains=q) |
            Q(City__icontains=q)
        )
        .select_related("Gruppo", "Insegna", "Categoria", "Associazione")
        .order_by("Title")[:20]
    )

    data = []
    for pv in results:
        gruppo_name = pv.Gruppo.Title if pv.Gruppo else None
        catalog_name = GRUPPO_TO_CATALOG.get(gruppo_name)

        has_catalog = False
        catalog_id = None
        if catalog_name and supplier_id and org:
            cat = Catalog.objects.filter(
                organization=org,
                supplier_id=supplier_id,
                client_name=catalog_name,
                is_active=True,
            ).first()
            if cat:
                has_catalog = True
                catalog_id = cat.id

        data.append({
            "id": pv.id,
            "title": pv.Title,
            "address": pv.Address or "",
            "city": pv.City or "",
            "cap": pv.Cap or "",
            "gruppo": gruppo_name or "",
            "insegna": pv.Insegna.Title if pv.Insegna else "",
            "categoria": pv.Categoria.Title if pv.Categoria else "",
            "associazione": pv.Associazione.Title if pv.Associazione else "",
            "has_catalog": has_catalog,
            "catalog_id": catalog_id,
        })

    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def catalog_clients(request, supplier_id):
    from pdf_upload.models_pwa import Catalog
    org = request.user.organization_set.first()
    if not org:
        return Response([])

    catalogs = (
        Catalog.objects.filter(
            organization=org, supplier_id=supplier_id, is_active=True
        )
        .annotate(product_count=Count("products"))
        .order_by("client_name")
    )
    data = [
        {
            "id": c.id,
            "name": c.client_name,
            "code": c.client_code,
            "product_count": c.product_count,
        }
        for c in catalogs
    ]
    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def catalog_detail(request, catalog_id):
    from pdf_upload.models_pwa import Catalog
    org = request.user.organization_set.first()
    if not org:
        return Response({"detail": "Organizzazione non trovata."}, status=403)

    try:
        catalog = Catalog.objects.prefetch_related(
            "categories__products"
        ).get(organization=org, id=catalog_id, is_active=True)
    except Catalog.DoesNotExist:
        return Response({"detail": "Catalogo non trovato."}, status=404)

    data = {
        "id": catalog.id,
        "supplier_name": catalog.supplier.Title,
        "client": catalog.client_name,
        "categories": [
            {
                "id": cat.id,
                "name": cat.name,
                "color": cat.color,
                "products": [
                    {
                        "id": p.id,
                        "code": p.code,
                        "ean": p.ean,
                        "internal_code": p.internal_code,
                        "description": p.description,
                        "weight": p.weight,
                        "qxc": p.qxc,
                        "default_promo": p.default_promo,
                    }
                    for p in cat.products.all()
                ],
            }
            for cat in catalog.categories.all()
        ],
    }
    return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def order_send_email(request):
    """
    POST /api/catalogo/ordini/invia/

    Generates a PDF order in the agency's standard format
    and sends it via email to the organization + collaborator.
    """
    import os
    import smtplib
    import re
    from io import BytesIO
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.application import MIMEApplication
    from datetime import date
    from django.template.loader import render_to_string
    from xhtml2pdf import pisa
    from pdf_upload.models import Collaboratori, Clienti
    from pdf_upload.models_pwa import Catalog, CatalogProduct

    user = request.user
    org = user.organization_set.first()
    data = request.data

    # Get collaboratore
    try:
        collab = Collaboratori.objects.get(User=user, deleted_at__isnull=True)
        collab_name = collab.Title
        collab_email = collab.Email
    except Exception:
        collab_name = user.get_full_name() or user.username
        collab_email = user.email

    # Get catalog
    try:
        catalog = Catalog.objects.select_related("supplier").get(
            id=data["client_id"], organization=org, is_active=True
        )
    except Catalog.DoesNotExist:
        return Response({"detail": "Catalogo non trovato."}, status=404)

    # Get punto vendita info
    pv_id = data.get("pv_id")
    pv_title = ""
    pv_address = ""
    pv_city = ""
    gruppo_name = ""
    insegna_name = ""
    categoria_name = ""
    associazione_name = ""

    if pv_id:
        try:
            pv = Clienti.objects.select_related(
                "Gruppo", "Insegna", "Categoria", "Associazione"
            ).get(id=pv_id)
            pv_title = pv.Title or ""
            pv_address = pv.Address or ""
            pv_city = pv.City or ""
            gruppo_name = pv.Gruppo.Title if pv.Gruppo else ""
            insegna_name = pv.Insegna.Title if pv.Insegna else ""
            categoria_name = pv.Categoria.Title if pv.Categoria else ""
            associazione_name = pv.Associazione.Title if pv.Associazione else ""
        except Clienti.DoesNotExist:
            pass

    supplier_name = catalog.supplier.Title
    lines = data.get("lines", [])
    notes = data.get("notes", "")

    # Build product lookup
    product_ids = [l["product_id"] for l in lines]
    products = {
        p.id: p for p in CatalogProduct.objects.filter(id__in=product_ids)
    }

    # Build submitted rows (only lines with values)
    submitted_rows = []
    total_quantity = 0
    total_omaggi = 0
    for line in lines:
        ordine = int(line.get("ordine", 0) or 0)
        omaggi = int(line.get("omaggi", 0) or 0)
        if ordine == 0 and omaggi == 0:
            continue
        product = products.get(line["product_id"])
        if not product:
            continue
        submitted_rows.append({
            "code": product.code,
            "ean": product.ean,
            "codintfor": product.internal_code,
            "description": product.description,
            "weight": product.weight,
            "qxc": product.qxc,
            "promo": line.get("promo", ""),
            "ordine": ordine,
            "omaggi": omaggi if omaggi > 0 else "",
        })
        total_quantity += ordine
        total_omaggi += omaggi

    # Generate PDF from HTML template
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }}
        .header {{ margin-bottom: 15px; }}
        .header-row {{ margin-bottom: 3px; }}
        .label {{ font-weight: bold; display: inline-block; width: 120px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
        th {{ background-color: #10B981; color: white; padding: 6px 4px;
              text-align: left; font-size: 10px; font-weight: bold; }}
        td {{ padding: 4px; border-bottom: 1px solid #ddd; font-size: 10px; }}
        tr:nth-child(even) {{ background-color: #f9f9f9; }}
        .totals {{ margin-top: 15px; font-size: 11px; }}
        .totals p {{ margin: 3px 0; }}
        .title {{ font-size: 14px; font-weight: bold; margin-bottom: 10px; }}
        .notes {{ margin-top: 10px; padding: 8px; background: #f5f5f5;
                  border-left: 3px solid #10B981; font-style: italic; }}
        .page-info {{ font-size: 9px; color: #888; text-align: right; }}
    </style>
    </head>
    <body>
        <div class="page-info">Pagina 1 di 1</div>
        <div class="header">
            <div class="header-row"><span class="label">Clienti :</span>{pv_title} - {pv_address}</div>
            <div class="title">Ordini PDF</div>
            <div class="header-row"><span class="label">Date :</span>{date.today().strftime('%B %d, %Y')}</div>
            <div class="header-row"><span class="label">Fornitore :</span>{supplier_name}</div>
            <div class="header-row">
                <span class="label">Gruppo :</span>{gruppo_name}
                <span style="margin-left:30px"><span class="label">Categoria :</span>{categoria_name}</span>
            </div>
            <div class="header-row">
                <span class="label">Insegna :</span>{insegna_name}
                <span style="margin-left:30px"><span class="label">Collaboratori :</span>{collab_name}</span>
            </div>
            <div class="header-row"><span class="label">Note :</span>{notes}</div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Codice</th>
                    <th>EAN</th>
                    <th>CodIntFor</th>
                    <th>Descrizione</th>
                    <th>Peso</th>
                    <th>Qxc</th>
                    <th>promo</th>
                    <th>sellIn</th>
                    <th>sellOut</th>
                    <th>Omaggi</th>
                    <th>Quantita</th>
                </tr>
            </thead>
            <tbody>
    """

    for row in submitted_rows:
        html_content += f"""
                <tr>
                    <td>{row['code']}</td>
                    <td>{row['ean']}</td>
                    <td>{row['codintfor']}</td>
                    <td>{row['description']}</td>
                    <td>{row['weight']}</td>
                    <td>{row['qxc']}</td>
                    <td>{row['promo']}</td>
                    <td>0</td>
                    <td>-</td>
                    <td>{row['omaggi']}</td>
                    <td>{row['ordine']}</td>
                </tr>
        """

    html_content += f"""
            </tbody>
        </table>

        <div class="totals">
            <p><strong>Quantita totale :</strong>{total_quantity}</p>
            <p><strong>Prezzo totale :</strong>0,00</p>
            <p><strong>Quantita Omaggi :</strong>{total_omaggi},00</p>
        </div>
    </body>
    </html>
    """

    # Generate PDF
    pdf_buffer = BytesIO()
    pisa_status = pisa.CreatePDF(html_content, dest=pdf_buffer)
    pdf_buffer.seek(0)

    if pisa_status.err:
        return Response({"detail": "Errore generazione PDF"}, status=500)

    # Build filename: FORNITORE_CLIENTE_INDIRIZZO_CITTA.pdf
    def clean_name(s):
        s = s.upper().strip()
        s = re.sub(r'[^A-Z0-9\s]', '', s)
        s = re.sub(r'\s+', '_', s)
        return s

    filename = f"{clean_name(supplier_name)}_{clean_name(pv_title)}_{clean_name(pv_address)}_{clean_name(pv_city)}.pdf"
    # Truncate if too long
    if len(filename) > 200:
        filename = filename[:196] + ".pdf"

    # Build email
    recipients = []
    if org and org.Email:
        recipients.append(org.Email)
    if collab_email:
        recipients.append(collab_email)
    if not recipients:
        recipients = [os.getenv("EMAIL_HOST_USER")]

    msg = MIMEMultipart()
    msg["From"] = os.getenv("EMAIL_HOST_USER")
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = f"{pv_title} - {pv_address}, {collab_name}"
    msg["Reply-To"] = collab_email or os.getenv("EMAIL_HOST_USER")

    body = f"""Ordine inviato da {collab_name}

Fornitore: {supplier_name}
Cliente: {pv_title} - {pv_address}, {pv_city}
Gruppo: {gruppo_name}
Righe: {len(submitted_rows)}
Data: {date.today().strftime('%d/%m/%Y')}"""

    if notes:
        body += f"\n\nNote:\n{notes}"

    body += "\n\n--\nInviato da Evoluzione Agenti"

    msg.attach(MIMEText(body, "plain"))

    part = MIMEApplication(pdf_buffer.read(), Name=filename)
    part["Content-Disposition"] = f'attachment; filename="{filename}"'
    msg.attach(part)
    pdf_buffer.close()

    # Send
    try:
        with smtplib.SMTP(os.getenv("EMAIL_HOST"), int(os.getenv("EMAIL_PORT"))) as server:
            server.starttls()
            server.login(
                os.getenv("EMAIL_HOST_USER"),
                os.getenv("EMAIL_HOST_PASSWORD"),
            )
            server.send_message(msg)
    except Exception as e:
        return Response({"detail": f"Errore invio email: {str(e)}"}, status=500)

    return Response({
        "id": 0,
        "status": "sent",
        "line_count": len(submitted_rows),
        "recipients": recipients,
    }, status=201)
