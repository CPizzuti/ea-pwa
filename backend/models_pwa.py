"""
Models for the Agent PWA.

Add to your existing models.py or import from here.
These models support the PWA catalog and agent profile features.
"""

from django.conf import settings
from django.db import models


class AgentProfile(models.Model):
    """
    Extended profile for agent users.
    Stores PWA-specific settings like enabled modules.
    One-to-one with the Django User model.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="agent_profile",
    )
    organization = models.ForeignKey(
        "Organization",
        on_delete=models.CASCADE,
        related_name="agent_profiles",
    )
    full_name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    enabled_modules = models.JSONField(
        default=list,
        blank=True,
        help_text='List of enabled module IDs, e.g. ["orders", "clients", "map"]',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "agent_profile"
        verbose_name = "Profilo agente"
        verbose_name_plural = "Profili agente"

    def __str__(self):
        return f"{self.full_name or self.user.username} ({self.organization})"


class Catalog(models.Model):
    """
    A product catalog = one supplier × client combination.
    Created when the agency uploads an Excel price list template.
    """

    organization = models.ForeignKey(
        "Organization",
        on_delete=models.CASCADE,
        related_name="catalogs",
    )
    supplier = models.ForeignKey(
        "Fornitore",
        on_delete=models.CASCADE,
        related_name="catalogs",
    )
    client_name = models.CharField(
        max_length=100,
        help_text="GDO client name, e.g. Gros, Elite, Pac2000",
    )
    client_code = models.CharField(max_length=50, blank=True)
    source_file = models.CharField(
        max_length=255,
        blank=True,
        help_text="Original uploaded Excel filename",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "catalog"
        verbose_name = "Catalogo"
        verbose_name_plural = "Cataloghi"
        unique_together = ["organization", "supplier", "client_name"]
        ordering = ["supplier__Title", "client_name"]

    def __str__(self):
        return f"{self.supplier} → {self.client_name}"


class CatalogCategory(models.Model):
    """
    Product category within a catalog.
    Maps to the colored separator rows in the Excel templates.
    """

    catalog = models.ForeignKey(
        Catalog,
        on_delete=models.CASCADE,
        related_name="categories",
    )
    name = models.CharField(max_length=200)
    color = models.CharField(
        max_length=7,
        default="#10B981",
        help_text="Hex color from the Excel Color column",
    )
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "catalog_category"
        verbose_name = "Categoria catalogo"
        verbose_name_plural = "Categorie catalogo"
        ordering = ["sort_order"]

    def __str__(self):
        return f"{self.name} ({self.catalog})"


class CatalogProduct(models.Model):
    """
    A product row within a catalog category.
    Maps to the data rows in the Excel templates.
    Fields match the 10-column Excel structure.
    """

    category = models.ForeignKey(
        CatalogCategory,
        on_delete=models.CASCADE,
        related_name="products",
    )
    catalog = models.ForeignKey(
        Catalog,
        on_delete=models.CASCADE,
        related_name="products",
    )
    code = models.CharField(
        max_length=50,
        blank=True,
        help_text="Codice (Excel col B)",
    )
    ean = models.CharField(
        max_length=20,
        blank=True,
        help_text="EAN barcode (Excel col C)",
    )
    internal_code = models.CharField(
        max_length=50,
        blank=True,
        help_text="CodIntFor — supplier internal code (Excel col D)",
    )
    description = models.CharField(
        max_length=300,
        help_text="Descrizione (Excel col E)",
    )
    weight = models.CharField(
        max_length=50,
        blank=True,
        help_text="Peso (Excel col F)",
    )
    qxc = models.PositiveIntegerField(
        default=1,
        help_text="Quantità per collo (Excel col G)",
    )
    default_promo = models.CharField(
        max_length=50,
        blank=True,
        help_text="Default promo value pre-filled by agency (Excel col H)",
    )
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "catalog_product"
        verbose_name = "Prodotto catalogo"
        verbose_name_plural = "Prodotti catalogo"
        ordering = ["sort_order"]

    def __str__(self):
        return self.description


class AgentOrder(models.Model):
    """
    An order submitted by an agent via the PWA.
    Phase 1: generates an email with Excel attachment.
    Phase 2: saved to DB with approval workflow.
    """

    STATUS_CHOICES = [
        ("draft", "Bozza"),
        ("submitted", "Inviato"),
        ("approved", "Approvato"),
        ("rejected", "Respinto"),
    ]

    organization = models.ForeignKey(
        "Organization",
        on_delete=models.CASCADE,
        related_name="agent_orders",
    )
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="agent_orders",
    )
    catalog = models.ForeignKey(
        Catalog,
        on_delete=models.CASCADE,
        related_name="orders",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="submitted",
    )
    notes = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_orders",
    )

    class Meta:
        db_table = "agent_order"
        verbose_name = "Ordine agente"
        verbose_name_plural = "Ordini agente"
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"Ordine #{self.pk} — {self.catalog} ({self.get_status_display()})"


class AgentOrderLine(models.Model):
    """
    Single product line within an agent order.
    """

    order = models.ForeignKey(
        AgentOrder,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    product = models.ForeignKey(
        CatalogProduct,
        on_delete=models.CASCADE,
        related_name="order_lines",
    )
    ordine = models.PositiveIntegerField(
        default=0,
        help_text="Quantità ordinata",
    )
    omaggi = models.PositiveIntegerField(
        default=0,
        help_text="Quantità omaggio",
    )
    promo = models.CharField(
        max_length=50,
        blank=True,
        help_text="Sconto / promozione",
    )

    class Meta:
        db_table = "agent_order_line"
        verbose_name = "Riga ordine agente"
        verbose_name_plural = "Righe ordine agente"

    def __str__(self):
        return f"{self.product.description}: {self.ordine} + {self.omaggi} omg"
