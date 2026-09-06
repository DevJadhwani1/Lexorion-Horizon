package com.lexorion.horizon.product.dto;

import com.lexorion.horizon.product.entity.Product;
import com.lexorion.horizon.product.entity.ProductStatus;

public record ProductCatalogResponse(String key, String displayName, String description, ProductStatus status) {
   public static ProductCatalogResponse from(Product product) {
      return new ProductCatalogResponse(product.getKey(), product.getDisplayName(), product.getDescription(), product.getStatus());
   }
}
