package com.lexorion.platform.product.repository;

import com.lexorion.platform.product.entity.Product;
import com.lexorion.platform.product.entity.ProductStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, UUID> {
   Optional<Product> findByKey(String key);

   List<Product> findByStatusOrderByDisplayNameAsc(ProductStatus status);
}
