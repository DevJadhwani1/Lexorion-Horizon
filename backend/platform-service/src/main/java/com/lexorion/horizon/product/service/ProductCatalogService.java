package com.lexorion.horizon.product.service;

import com.lexorion.horizon.product.dto.ProductCatalogResponse;
import com.lexorion.horizon.product.entity.ProductStatus;
import com.lexorion.horizon.product.repository.ProductRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductCatalogService {
   private final ProductRepository repository;

   public ProductCatalogService(ProductRepository repository) {
      this.repository = repository;
   }

   @Transactional(
      readOnly = true
   )
   public List<ProductCatalogResponse> provisionableProducts() {
      return this.repository.findByStatusOrderByDisplayNameAsc(ProductStatus.ACTIVE).stream().map(ProductCatalogResponse::from).toList();
   }
}
