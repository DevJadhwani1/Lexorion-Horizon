package com.lexorion.platform.product.controller;

import com.lexorion.platform.product.dto.ProductCatalogResponse;
import com.lexorion.platform.product.service.ProductCatalogService;
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
   @PreAuthorize("@tenantAuthorization.hasAnyRole(T(com.lexorion.platform.membership.entity.OrganizationRole).OWNER, T(com.lexorion.platform.membership.entity.OrganizationRole).ADMIN)")
   public List<ProductCatalogResponse> list() {
      return this.service.provisionableProducts();
   }
}
