"""pdf_reader URL Configuration"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from api.views_pwa import agent_profile, catalog_suppliers, catalog_clients, catalog_detail, order_send_email, pv_search

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("authentication.urls")),
    path("account/", include("pdf_upload.urls")),
    path("prodotti/", include("prodotti.urls")),
    path("api/", include("api.urls")),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/agent/profile/", agent_profile, name="agent_profile"),
    path("api/catalogo/fornitori/", catalog_suppliers, name="catalog_suppliers"),
    path("api/catalogo/fornitori/<int:supplier_id>/clienti/", catalog_clients, name="catalog_clients"),
    path("api/catalogo/<int:catalog_id>/", catalog_detail, name="catalog_detail"),
    path("api/catalogo/ordini/invia/", order_send_email, name="order_send_email"),
    path("api/pv/search/", pv_search, name="pv_search"),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL,
                          document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)
