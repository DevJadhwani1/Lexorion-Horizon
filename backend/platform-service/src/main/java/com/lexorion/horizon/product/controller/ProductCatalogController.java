package com.lexorion.horizon.product.controller;

import com.lexorion.horizon.product.dto.ProductCatalogResponse;
import com.lexorion.horizon.product.service.ProductCatalogService;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/platform/products"})
public class ProductCatalogController {
   private final ProductCatalogService service;

   public ProductCatalogController(ProductCatalogService service) {
      this.service = service;
   }

   @GetMapping
   @PreAuthorize("hasAuthority('PLATFORM_ACCESS') or @tenantAuthorization.hasAnyRole(T(com.lexorion.horizon.membership.entity.OrganizationRole).ADMIN)")
   public List<ProductCatalogResponse> list() {
      return this.service.provisionableProducts();
   }
}
