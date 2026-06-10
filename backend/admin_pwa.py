"""
Admin configuration for PWA models.
Add to your existing admin.py.
"""

from django.contrib import admin
from .models_pwa import (
    AgentProfile,
    Catalog,
    CatalogCategory,
    CatalogProduct,
    AgentOrder,
    AgentOrderLine,
)


@admin.register(AgentProfile)
class AgentProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "full_name", "organization", "enabled_modules", "is_active"]
    list_filter = ["organization", "is_active"]
    search_fields = ["user__username", "full_name"]
    raw_id_fields = ["user", "organization"]


class CatalogCategoryInline(admin.TabularInline):
    model = CatalogCategory
    extra = 0
    show_change_link = True


@admin.register(Catalog)
class CatalogAdmin(admin.ModelAdmin):
    list_display = [
        "supplier",
        "client_name",
        "organization",
        "product_count",
        "is_active",
        "updated_at",
    ]
    list_filter = ["organization", "is_active", "supplier"]
    search_fields = ["client_name", "supplier__Title"]
    inlines = [CatalogCategoryInline]

    def product_count(self, obj):
        return obj.products.count()

    product_count.short_description = "Prodotti"


class CatalogProductInline(admin.TabularInline):
    model = CatalogProduct
    extra = 0
    fields = ["code", "description", "ean", "qxc", "default_promo", "sort_order"]


@admin.register(CatalogCategory)
class CatalogCategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "catalog", "color", "product_count", "sort_order"]
    list_filter = ["catalog__organization", "catalog__supplier"]
    inlines = [CatalogProductInline]

    def product_count(self, obj):
        return obj.products.count()

    product_count.short_description = "Prodotti"


class AgentOrderLineInline(admin.TabularInline):
    model = AgentOrderLine
    extra = 0
    raw_id_fields = ["product"]
    readonly_fields = ["product", "ordine", "omaggi", "promo"]


@admin.register(AgentOrder)
class AgentOrderAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "agent",
        "catalog",
        "status",
        "line_count",
        "submitted_at",
    ]
    list_filter = ["status", "organization"]
    readonly_fields = ["agent", "catalog", "organization", "submitted_at"]
    inlines = [AgentOrderLineInline]

    def line_count(self, obj):
        return obj.lines.count()

    line_count.short_description = "Righe"
