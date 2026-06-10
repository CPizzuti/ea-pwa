"""
Views for the Agent PWA.

Add these to your existing urls.py or create a separate urls_pwa.py.
All views require JWT authentication and filter by organization.
"""

from django.db.models import Count
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models_pwa import (
    AgentProfile,
    Catalog,
    CatalogProduct,
    AgentOrder,
    AgentOrderLine,
)
from .serializers_pwa import (
    AgentProfileSerializer,
    SupplierListSerializer,
    ClientListSerializer,
    CatalogDetailSerializer,
    OrderSubmitSerializer,
    AgentOrderSerializer,
)


def get_organization(user):
    """
    Get the organization for the current user.
    Supports both the existing organization_set pattern
    and the new AgentProfile model.
    """
    # Try AgentProfile first (new pattern)
    try:
        profile = user.agent_profile
        return profile.organization
    except AgentProfile.DoesNotExist:
        pass

    # Fallback: existing pattern via organization_set
    org = user.organization_set.first()
    return org


# ─── Agent Profile ───────────────────────────────────────────────


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def agent_profile(request):
    """
    GET /api/agent/profile/

    Returns the agent's profile with organization and enabled modules.
    Called by the PWA on login to configure the app shell.

    Response:
    {
        "id": 1,
        "username": "mario.rossi",
        "full_name": "Mario Rossi",
        "email": "mario@example.com",
        "phone": "+39 333 1234567",
        "organization": {
            "id": 1,
            "name": "Agenzia Rossi Srl",
            "logo_url": null
        },
        "enabled_modules": ["orders", "clients"]
    }
    """
    user = request.user
    org = get_organization(user)

    if not org:
        return Response(
            {"detail": "Nessuna organizzazione associata all'utente."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Build or get the AgentProfile
    profile, created = AgentProfile.objects.get_or_create(
        user=user,
        defaults={
            "organization": org,
            "full_name": user.get_full_name() or user.username,
            "enabled_modules": ["orders"],  # Default: only orders module
        },
    )

    # Always keep org in sync
    if profile.organization_id != org.pk:
        profile.organization = org
        profile.save(update_fields=["organization"])

    serializer = AgentProfileSerializer(profile, context={"request": request})
    return Response(serializer.data)


# ─── Catalog: Suppliers ──────────────────────────────────────────


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def catalog_suppliers(request):
    """
    GET /api/catalogo/fornitori/

    Returns all suppliers that have at least one active catalog
    in the agent's organization.

    Response:
    [
        { "id": 1, "name": "COSWELL HF", "icon": "Package", "client_count": 3 },
        { "id": 2, "name": "D&C", "icon": "Package", "client_count": 3 },
        ...
    ]
    """
    org = get_organization(request.user)
    if not org:
        return Response([], status=status.HTTP_200_OK)

    # Get suppliers with active catalogs, annotated with client count
    # Using the Catalog model to find which suppliers have catalogs
    from django.db.models import F

    supplier_ids = (
        Catalog.objects.filter(organization=org, is_active=True)
        .values("supplier_id")
        .distinct()
    )

    # Import your Fornitore model
    from .models import Fornitore

    suppliers = (
        Fornitore.objects.filter(id__in=supplier_ids)
        .annotate(
            client_count=Count(
                "catalogs",
                filter=models.Q(
                    catalogs__organization=org, catalogs__is_active=True
                ),
            )
        )
        .order_by("Title")
    )

    serializer = SupplierListSerializer(suppliers, many=True)
    return Response(serializer.data)


# ─── Catalog: Clients per Supplier ───────────────────────────────


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def catalog_clients(request, supplier_id):
    """
    GET /api/catalogo/fornitori/{supplier_id}/clienti/

    Returns all clients (GDO) for a supplier within the agent's organization.

    Response:
    [
        { "id": 1, "name": "Gros", "code": "GROS", "product_count": 85 },
        { "id": 2, "name": "Elite", "code": "ELITE", "product_count": 72 },
        ...
    ]
    """
    org = get_organization(request.user)
    if not org:
        return Response([], status=status.HTTP_200_OK)

    catalogs = (
        Catalog.objects.filter(
            organization=org,
            supplier_id=supplier_id,
            is_active=True,
        )
        .annotate(product_count=Count("products"))
        .order_by("client_name")
    )

    serializer = ClientListSerializer(catalogs, many=True)
    return Response(serializer.data)


# ─── Catalog: Full Product List ──────────────────────────────────


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def catalog_detail(request, supplier_id, client_id):
    """
    GET /api/catalogo/{supplier_id}/{client_id}/

    Returns the full product catalog with categories and products.
    This is what the PWA renders as the order form.

    Response:
    {
        "id": 1,
        "supplier_name": "COSWELL HF",
        "client": "Gros",
        "categories": [
            {
                "id": 1,
                "name": "Tisane a caldo",
                "color": "#7DEC18",
                "products": [
                    {
                        "id": 1,
                        "code": "GA1992900",
                        "ean": "8002890025388",
                        "description": "Tisana Linea 18 filtri",
                        "weight": "",
                        "qxc": 10,
                        "default_promo": ""
                    },
                    ...
                ]
            },
            ...
        ]
    }
    """
    org = get_organization(request.user)
    if not org:
        return Response(
            {"detail": "Organizzazione non trovata."},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        catalog = (
            Catalog.objects.prefetch_related("categories__products")
            .get(
                organization=org,
                supplier_id=supplier_id,
                id=client_id,
                is_active=True,
            )
        )
    except Catalog.DoesNotExist:
        return Response(
            {"detail": "Catalogo non trovato."},
            status=status.HTTP_404_NOT_FOUND,
        )

    serializer = CatalogDetailSerializer(catalog)
    return Response(serializer.data)


# ─── Order Submission ────────────────────────────────────────────


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def order_submit(request):
    """
    POST /api/catalogo/ordini/invia/

    Submits an order from the PWA.

    Request body:
    {
        "supplier_id": 1,
        "client_id": 1,
        "lines": [
            { "product_id": 1, "ordine": 5, "omaggi": 0, "promo": "" },
            { "product_id": 7, "ordine": 10, "omaggi": 2, "promo": "10%" }
        ],
        "notes": ""
    }

    Response:
    { "id": 42, "status": "submitted", "line_count": 2 }
    """
    org = get_organization(request.user)
    if not org:
        return Response(
            {"detail": "Organizzazione non trovata."},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = OrderSubmitSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    # Find the catalog
    try:
        catalog = Catalog.objects.get(
            organization=org,
            supplier_id=data["supplier_id"],
            id=data["client_id"],
            is_active=True,
        )
    except Catalog.DoesNotExist:
        return Response(
            {"detail": "Catalogo non trovato."},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Create the order
    order = AgentOrder.objects.create(
        organization=org,
        agent=request.user,
        catalog=catalog,
        status="submitted",
        notes=data.get("notes", ""),
    )

    # Create order lines (only lines with actual values)
    lines_to_create = []
    for line_data in data["lines"]:
        if line_data["ordine"] > 0 or line_data["omaggi"] > 0 or line_data.get("promo"):
            lines_to_create.append(
                AgentOrderLine(
                    order=order,
                    product_id=line_data["product_id"],
                    ordine=line_data["ordine"],
                    omaggi=line_data["omaggi"],
                    promo=line_data.get("promo", ""),
                )
            )

    AgentOrderLine.objects.bulk_create(lines_to_create)

    return Response(
        {
            "id": order.pk,
            "status": order.status,
            "line_count": len(lines_to_create),
        },
        status=status.HTTP_201_CREATED,
    )


# ─── Order History ───────────────────────────────────────────────


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def order_history(request):
    """
    GET /api/catalogo/ordini/

    Returns the agent's order history (for the 'Inviati' tab).
    """
    org = get_organization(request.user)
    if not org:
        return Response([], status=status.HTTP_200_OK)

    orders = (
        AgentOrder.objects.filter(organization=org, agent=request.user)
        .select_related("catalog__supplier")
        .prefetch_related("lines")
        .order_by("-submitted_at")[:50]
    )

    serializer = AgentOrderSerializer(orders, many=True)
    return Response(serializer.data)
