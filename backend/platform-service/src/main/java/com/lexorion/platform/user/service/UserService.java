package com.lexorion.platform.user.service;

import com.lexorion.platform.exception.DuplicateResourceException;
import com.lexorion.platform.exception.ResourceNotFoundException;
import com.lexorion.platform.user.dto.CreateUserRequest;
import com.lexorion.platform.user.dto.UpdateUserRequest;
import com.lexorion.platform.user.dto.UserResponse;
import com.lexorion.platform.user.entity.User;
import com.lexorion.platform.user.entity.UserStatus;
import com.lexorion.platform.user.repository.UserRepository;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class UserService {
   private final UserRepository userRepository;
   private final PasswordEncoder passwordEncoder;

   public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
      this.userRepository = userRepository;
      this.passwordEncoder = passwordEncoder;
   }

   public UserResponse create(CreateUserRequest request) {
      String email = normalizeEmail(request.email());
      if (this.userRepository.existsByEmailIgnoreCase(email)) {
         throw new DuplicateResourceException("Email already in use: " + email);
      } else {
         User user = new User();
         user.setEmail(email);
         user.setFirstName(request.firstName());
         user.setLastName(request.lastName());
         user.setPasswordHash(this.passwordEncoder.encode(request.password()));
         user.setStatus(UserStatus.ACTIVE);
         return UserResponse.from((User)this.userRepository.save(user));
      }
   }

   @Transactional(
      readOnly = true
   )
   public UserResponse getById(UUID id) {
      return UserResponse.from(this.findOrThrow(id));
   }

   @Transactional(
      readOnly = true
   )
   public List<UserResponse> list() {
      return this.userRepository.findAll().stream().map(UserResponse::from).toList();
   }

   public UserResponse update(UUID id, UpdateUserRequest request) {
      User user = this.findOrThrow(id);
      if (request.firstName() != null) {
         user.setFirstName(request.firstName());
      }

      if (request.lastName() != null) {
         user.setLastName(request.lastName());
      }

      if (request.status() != null) {
         user.setStatus(request.status());
      }

      return UserResponse.from((User)this.userRepository.saveAndFlush(user));
   }

   @Transactional(
      readOnly = true
   )
   public User getEntity(UUID id) {
      return this.findOrThrow(id);
   }

   private User findOrThrow(UUID id) {
      return (User)this.userRepository.findById(id).orElseThrow(() -> ResourceNotFoundException.of("User", id));
   }

   public static String normalizeEmail(String email) {
      return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
   }
}
