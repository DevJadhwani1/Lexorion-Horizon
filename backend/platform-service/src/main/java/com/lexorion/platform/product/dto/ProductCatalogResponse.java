package com.lexorion.platform.product.dto;

import com.lexorion.platform.product.entity.Product;
import com.lexorion.platform.product.entity.ProductStatus;

public record ProductCatalogResponse(String key, String displayName, String description, ProductStatus status) {
   public static ProductCatalogResponse from(Product product) {
      return new ProductCatalogResponse(product.getKey(), product.getDisplayName(), product.getDescription(), product.getStatus());
   }
}
