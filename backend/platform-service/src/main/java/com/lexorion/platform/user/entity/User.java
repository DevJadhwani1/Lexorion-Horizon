package com.lexorion.platform.user.entity;

import com.lexorion.platform.config.Auditable;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;
import lombok.Generated;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(
   name = "users",
   uniqueConstraints = {@UniqueConstraint(
   name = "uk_users_email",
   columnNames = {"email"}
)}
)
public class User extends Auditable {
   @Id
   @UuidGenerator
   @Column(
      nullable = false,
      updatable = false
   )
   private UUID id;
   @Column(
      nullable = false
   )
   private String email;
   @Column(
      name = "first_name",
      nullable = false
   )
   private String firstName;
   @Column(
      name = "last_name",
      nullable = false
   )
   private String lastName;
   @Column(
      name = "password_hash",
      nullable = false
   )
   private String passwordHash;
   @Enumerated(EnumType.STRING)
   @Column(
      nullable = false,
      length = 20
   )
   private UserStatus status;

   @Generated
   public UUID getId() {
      return this.id;
   }

   @Generated
   public String getEmail() {
      return this.email;
   }

   @Generated
   public String getFirstName() {
      return this.firstName;
   }

   @Generated
   public String getLastName() {
      return this.lastName;
   }

   @Generated
   public String getPasswordHash() {
      return this.passwordHash;
   }

   @Generated
   public UserStatus getStatus() {
      return this.status;
   }

   @Generated
   public void setId(final UUID id) {
      this.id = id;
   }

   @Generated
   public void setEmail(final String email) {
      this.email = email;
   }

   @Generated
   public void setFirstName(final String firstName) {
      this.firstName = firstName;
   }

   @Generated
   public void setLastName(final String lastName) {
      this.lastName = lastName;
   }

   @Generated
   public void setPasswordHash(final String passwordHash) {
      this.passwordHash = passwordHash;
   }

   @Generated
   public void setStatus(final UserStatus status) {
      this.status = status;
   }

   @Generated
   public User() {
      this.status = UserStatus.ACTIVE;
   }
}
