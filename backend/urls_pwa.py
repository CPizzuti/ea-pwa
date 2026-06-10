"""
URL patterns for the Agent PWA endpoints.

Add these to your main urls.py:

    from .urls_pwa import pwa_urlpatterns
    urlpatterns += pwa_urlpatterns

Or include them directly:

    path('api/', include('api.urls_pwa')),
"""

from django.urls import path
from . import views_pwa

pwa_urlpatterns = [
    # Agent profile (called on login)
    path(
        "api/agent/profile/",
        views_pwa.agent_profile,
        name="agent-profile",
    ),
    # Catalog browsing (3-step flow)
    path(
        "api/catalogo/fornitori/",
        views_pwa.catalog_suppliers,
        name="catalog-suppliers",
    ),
    path(
        "api/catalogo/fornitori/<int:supplier_id>/clienti/",
        views_pwa.catalog_clients,
        name="catalog-clients",
    ),
    path(
        "api/catalogo/<int:supplier_id>/<int:client_id>/",
        views_pwa.catalog_detail,
        name="catalog-detail",
    ),
    # Order submission and history
    path(
        "api/catalogo/ordini/invia/",
        views_pwa.order_submit,
        name="order-submit",
    ),
    path(
        "api/catalogo/ordini/",
        views_pwa.order_history,
        name="order-history",
    ),
]
