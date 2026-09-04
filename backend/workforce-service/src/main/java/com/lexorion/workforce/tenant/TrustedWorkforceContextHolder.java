package com.lexorion.workforce.tenant;
import java.util.Optional;
import org.springframework.stereotype.Component;
@Component public class TrustedWorkforceContextHolder {
    private final ThreadLocal<TrustedWorkforceContext> value=new ThreadLocal<>();
    public Optional<TrustedWorkforceContext> get(){return Optional.ofNullable(value.get());} public void set(TrustedWorkforceContext context){value.set(context);} public void clear(){value.remove();}
}
