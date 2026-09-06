package com.lexorion.platform.bootstrap;

import com.lexorion.core.product.CoreProduct;
import com.lexorion.core.product.CoreProductRepository;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LexorionProductCatalog {
    @Bean ApplicationRunner lexorionProducts(CoreProductRepository products) {
        return args -> {
            for (var product : java.util.List.of(new CoreProduct("horizon", "Horizon", true),
                    new CoreProduct("axon", "Axon", false), new CoreProduct("atlas", "Atlas", false))) {
                if (!products.existsById(product.getKey())) products.save(product);
            }
        };
    }
}
