package com.lexorion.horizon.product.config;

import com.lexorion.horizon.product.entity.Product;
import com.lexorion.horizon.product.entity.ProductStatus;
import com.lexorion.horizon.product.repository.ProductRepository;
import java.util.List;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(20)
public class ProductCatalogSeeder implements ApplicationRunner {
   private static final List<Seed> INITIAL_CATALOG = List.of(new Seed("horizon", "Horizon", "Lexorion's core organization and administration platform."), new Seed("workforce", "Workforce", "People and workforce operations."), new Seed("payroll", "Payroll", "Payroll processing and administration."), new Seed("finance", "Finance", "Finance operations and reporting."));
   private final ProductRepository repository;

   public ProductCatalogSeeder(ProductRepository repository) {
      this.repository = repository;
   }

   @Transactional
   public void run(ApplicationArguments args) {
      for(Seed seed : INITIAL_CATALOG) {
         if (this.repository.findByKey(seed.key()).isEmpty()) {
            Product product = new Product();
            product.setKey(seed.key());
            product.setDisplayName(seed.name());
            product.setDescription(seed.description());
            product.setStatus(ProductStatus.ACTIVE);
            this.repository.save(product);
         }
      }

   }

   private static record Seed(String key, String name, String description) {
   }
}
