"""
Serializers for the Agent PWA endpoints.
Add to your existing serializers.py or import from here.
"""

from rest_framework import serializers
from .models_pwa import (
    AgentProfile,
    Catalog,
    CatalogCategory,
    CatalogProduct,
    AgentOrder,
    AgentOrderLine,
)


# ─── Agent Profile ───────────────────────────────────────────────


class OrganizationSerializer(serializers.Serializer):
    """Nested organization info in the profile response."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    logo_url = serializers.SerializerMethodField()

    def get_logo_url(self, obj):
        # Adapt to your Organization model's logo field
        if hasattr(obj, "logo") and obj.logo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None


class AgentProfileSerializer(serializers.Serializer):
    """
    GET /api/agent/profile/

    Returns the agent's identity, organization, and enabled modules.
    The PWA uses this to configure the app shell on login.
    """

    id = serializers.IntegerField(source="user.id")
    username = serializers.CharField(source="user.username")
    full_name = serializers.CharField()
    email = serializers.EmailField(source="user.email")
    phone = serializers.CharField()
    organization = OrganizationSerializer()
    enabled_modules = serializers.ListField(child=serializers.CharField())


# ─── Catalog: Suppliers ──────────────────────────────────────────


class SupplierListSerializer(serializers.Serializer):
    """
    GET /api/catalogo/fornitori/

    Each supplier card in the PWA's first step.
    client_count tells the agent how many clients are available.
    """

    id = serializers.IntegerField()
    name = serializers.CharField(source="Title")
    icon = serializers.SerializerMethodField()
    client_count = serializers.IntegerField()

    def get_icon(self, obj):
        # Default icon, override via admin if needed
        return getattr(obj, "pwa_icon", "Package")


# ─── Catalog: Clients per Supplier ───────────────────────────────


class ClientListSerializer(serializers.Serializer):
    """
    GET /api/catalogo/fornitori/{id}/clienti/

    Each client card in the PWA's second step.
    """

    id = serializers.IntegerField()
    name = serializers.CharField(source="client_name")
    code = serializers.CharField(source="client_code")
    product_count = serializers.IntegerField()


# ─── Catalog: Products ───────────────────────────────────────────


class CatalogProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = CatalogProduct
        fields = [
            "id",
            "code",
            "ean",
            "internal_code",
            "description",
            "weight",
            "qxc",
            "default_promo",
        ]


class CatalogCategorySerializer(serializers.ModelSerializer):
    products = CatalogProductSerializer(many=True, read_only=True)

    class Meta:
        model = CatalogCategory
        fields = ["id", "name", "color", "products"]


class CatalogDetailSerializer(serializers.ModelSerializer):
    """
    GET /api/catalogo/{supplier_id}/{client_id}/

    Full catalog with nested categories and products.
    This is what populates the order form in the PWA.
    """

    categories = CatalogCategorySerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source="supplier.Title", read_only=True)
    client = serializers.CharField(source="client_name", read_only=True)

    class Meta:
        model = Catalog
        fields = [
            "id",
            "supplier_name",
            "client",
            "categories",
        ]


# ─── Order Submission ────────────────────────────────────────────


class OrderLineInputSerializer(serializers.Serializer):
    """Single line in the order submission payload."""

    product_id = serializers.IntegerField()
    ordine = serializers.IntegerField(min_value=0, default=0)
    omaggi = serializers.IntegerField(min_value=0, default=0)
    promo = serializers.CharField(required=False, allow_blank=True, default="")


class OrderSubmitSerializer(serializers.Serializer):
    """
    POST /api/catalogo/ordini/invia/

    Payload sent by the PWA when the agent submits an order.
    """

    supplier_id = serializers.IntegerField()
    client_id = serializers.IntegerField()
    lines = OrderLineInputSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class AgentOrderLineSerializer(serializers.ModelSerializer):
    product_description = serializers.CharField(
        source="product.description", read_only=True
    )
    product_code = serializers.CharField(source="product.code", read_only=True)

    class Meta:
        model = AgentOrderLine
        fields = [
            "id",
            "product",
            "product_description",
            "product_code",
            "ordine",
            "omaggi",
            "promo",
        ]


class AgentOrderSerializer(serializers.ModelSerializer):
    """Order detail — used for the 'Inviati' tab in the PWA."""

    lines = AgentOrderLineSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(
        source="catalog.supplier.Title", read_only=True
    )
    client_name = serializers.CharField(
        source="catalog.client_name", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    line_count = serializers.IntegerField(source="lines.count", read_only=True)

    class Meta:
        model = AgentOrder
        fields = [
            "id",
            "supplier_name",
            "client_name",
            "status",
            "status_display",
            "line_count",
            "notes",
            "submitted_at",
            "reviewed_at",
        ]
