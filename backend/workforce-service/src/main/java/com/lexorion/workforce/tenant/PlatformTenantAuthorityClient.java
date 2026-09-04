package com.lexorion.workforce.tenant;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
@Component public class PlatformTenantAuthorityClient implements TenantAuthorityClient {
    private final RestClient client;
    public PlatformTenantAuthorityClient(@Qualifier("serviceRestClientBuilder") RestClient.Builder builder,@Value("${lexorion.platform-service-url}") String baseUrl){client=builder.baseUrl(baseUrl).build();}
    public TrustedWorkforceContext validate(String key,String token,String host,String slug){return request(key,token,host,slug,null);}
    public TrustedWorkforceContext requireEmployeeLimit(String key,int requested,String token,String host,String slug){return request(key,token,host,slug,requested);}
    public java.util.UUID resolveUser(String key,String email,String token,String host,String slug){var response=client.post().uri("/internal/workforce/workspaces/{key}/user-resolution",key).body(Map.of("email",email)).header(HttpHeaders.AUTHORIZATION,token).header(HttpHeaders.HOST,host).headers(h->{if(slug!=null)h.set("X-Lexorion-Organization",slug);}).retrieve().body(UserResolution.class);if(response==null||response.userId()==null)throw new IllegalStateException("Platform user resolution failed");return response.userId();}
    private record UserResolution(java.util.UUID userId){}
    private TrustedWorkforceContext request(String key,String token,String host,String slug,Integer requested){
        var spec=requested==null?client.get().uri("/internal/workforce/workspaces/{key}/context",key):client.post().uri("/internal/workforce/workspaces/{key}/employee-limit",key).body(Map.of("requestedValue",requested));
        return spec.header(HttpHeaders.AUTHORIZATION,token).header(HttpHeaders.HOST,host).headers(h->{if(slug!=null)h.set("X-Lexorion-Organization",slug);}).retrieve().body(TrustedWorkforceContext.class);
    }
}
