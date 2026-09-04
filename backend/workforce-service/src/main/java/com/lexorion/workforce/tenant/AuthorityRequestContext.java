package com.lexorion.workforce.tenant;
import org.springframework.stereotype.Component;
@Component public class AuthorityRequestContext {public record Credentials(String token,String host,String organizationSlug){}private final ThreadLocal<Credentials> value=new ThreadLocal<>();public void set(Credentials v){value.set(v);}public Credentials require(){Credentials v=value.get();if(v==null)throw new IllegalStateException("Trusted request credentials are unavailable");return v;}public void clear(){value.remove();}}
