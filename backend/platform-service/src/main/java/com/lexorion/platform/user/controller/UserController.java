package com.lexorion.platform.user.controller;

import com.lexorion.core.user.dto.CreateUserRequest;
import com.lexorion.core.user.dto.UpdateUserRequest;
import com.lexorion.core.user.dto.UserResponse;
import com.lexorion.core.user.service.UserService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/platform/users"})
public class UserController {
   private final UserService userService;

   public UserController(UserService userService) {
      this.userService = userService;
   }

   @PostMapping
   @PreAuthorize("hasAuthority('PLATFORM_ACCESS')")
   public ResponseEntity<UserResponse> create(@RequestBody @Valid CreateUserRequest request) {
      UserResponse created = this.userService.create(request);
      return ResponseEntity.created(URI.create("/api/platform/users/" + String.valueOf(created.id()))).body(created);
   }

   @GetMapping({"/{id}"})
   @PreAuthorize("@authorization.isSelfOrPlatform(authentication, #id)")
   public UserResponse getById(@PathVariable UUID id) {
      return this.userService.getById(id);
   }

   @GetMapping
   @PreAuthorize("hasAuthority('PLATFORM_ACCESS')")
   public List<UserResponse> list() {
      return this.userService.list();
   }

   @PatchMapping({"/{id}"})
   @PreAuthorize("@authorization.isSelfOrPlatform(authentication, #id)")
   public UserResponse update(@PathVariable UUID id, @RequestBody @Valid UpdateUserRequest request) {
      return this.userService.update(id, request);
   }
}
