package com.lexorion.platform.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import com.jayway.jsonpath.JsonPath;
import com.lexorion.core.auth.repository.RefreshTokenRepository;
import com.lexorion.core.user.entity.*;
import com.lexorion.core.user.repository.UserRepository;
import org.junit.jupiter.api.*;import org.springframework.beans.factory.annotation.Autowired;import org.springframework.boot.test.context.SpringBootTest;import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;import org.springframework.http.MediaType;import org.springframework.security.crypto.password.PasswordEncoder;import org.springframework.test.web.servlet.*;

@SpringBootTest @AutoConfigureMockMvc class AuthenticationSessionIntegrationTest{
 @Autowired MockMvc mvc;@Autowired UserRepository users;@Autowired RefreshTokenRepository tokens;@Autowired PasswordEncoder passwords;private User user;
 @BeforeEach void setup(){tokens.deleteAll();users.deleteAll();user=new User();user.setEmail("session@test.example");user.setFirstName("Session");user.setLastName("Test");user.setPasswordHash(passwords.encode("correct-password"));user.setStatus(UserStatus.ACTIVE);user=users.saveAndFlush(user);}
 @Test void rotationReuseRevokesTheEntireTokenFamily()throws Exception{String first=login().refresh();MvcResult rotated=mvc.perform(post("/api/platform/auth/refresh").contentType(MediaType.APPLICATION_JSON).content("{\"refreshToken\":\""+first+"\"}")).andExpect(status().isOk()).andReturn();String second=JsonPath.read(rotated.getResponse().getContentAsString(),"$.refreshToken");assertThat(second).isNotEqualTo(first);mvc.perform(post("/api/platform/auth/refresh").contentType(MediaType.APPLICATION_JSON).content("{\"refreshToken\":\""+first+"\"}")).andExpect(status().isUnauthorized());assertThat(tokens.findByUserIdAndRevokedFalse(user.getId())).isEmpty();mvc.perform(post("/api/platform/auth/refresh").contentType(MediaType.APPLICATION_JSON).content("{\"refreshToken\":\""+second+"\"}")).andExpect(status().isUnauthorized());}
 @Test void authenticatedUserCanRevokeEverySession()throws Exception{Tokens first=login(),second=login();assertThat(tokens.findByUserIdAndRevokedFalse(user.getId())).hasSize(2);mvc.perform(post("/api/platform/auth/sessions/revoke-all").header("Authorization","Bearer "+first.access())).andExpect(status().isNoContent());assertThat(tokens.findByUserIdAndRevokedFalse(user.getId())).isEmpty();mvc.perform(post("/api/platform/auth/refresh").contentType(MediaType.APPLICATION_JSON).content("{\"refreshToken\":\""+second.refresh()+"\"}")).andExpect(status().isUnauthorized());}
 private Tokens login()throws Exception{MvcResult result=mvc.perform(post("/api/platform/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"session@test.example\",\"password\":\"correct-password\"}")).andExpect(status().isOk()).andReturn();String body=result.getResponse().getContentAsString();return new Tokens(JsonPath.read(body,"$.accessToken"),JsonPath.read(body,"$.refreshToken"));}
 private record Tokens(String access,String refresh){}
}
