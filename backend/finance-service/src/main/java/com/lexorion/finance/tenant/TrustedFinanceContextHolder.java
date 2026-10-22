package com.lexorion.finance.tenant;

import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class TrustedFinanceContextHolder {
    private final ThreadLocal<TrustedFinanceContext> value = new ThreadLocal<>();

    public void set(TrustedFinanceContext context) { value.set(context); }

    public TrustedFinanceContext require() {
        return Optional.ofNullable(value.get()).orElseThrow(() -> new IllegalStateException("Trusted Finance context required"));
    }

    public void clear() { value.remove(); }
}
