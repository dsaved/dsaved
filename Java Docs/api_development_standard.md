# Java Enterprise API Development Standards

**Status**: World-Class Enterprise Standards  
**Framework**: Spring Boot 3.x with Spring Data JPA  
**Database**: PostgreSQL 14+  
**Target Scale**: 1 billion+ records per table  
**Code Quality**: Production-ready, security-focused, performance-optimized

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Entity Modeling Standards](#entity-modeling-standards)
3. [Repository & Query Optimization](#repository--query-optimization)
4. [Service Layer Standards](#service-layer-standards)
5. [Controller/REST Standards](#controllerrest-standards)
6. [DTO Standards](#dto-standards)
7. [Security Standards](#security-standards)
8. [Error Handling](#error-handling)
9. [Audit Logging](#audit-logging)
10. [Database Migrations](#database-migrations)
11. [Testing Standards](#testing-standards)
12. [Naming Conventions](#naming-conventions)
13. [Code Quality Checklist](#code-quality-checklist)

---

## Project Structure

```
src/
  main/
    java/
      com/yourcompany/
        config/
          DatabaseConfig.java              # JPA/Hibernate configuration
          SecurityConfig.java              # Spring Security configuration
          MapperConfig.java                # MapStruct configuration
        constructs/
          enums/
            OrderTypeEnum.java             # ✅ ALL enums here
            AccountStatus.java
            NotificationType.java
          constants/
            AppConstants.java              # Constants, audit actions, mime types
            MessageConstants.java          # User-facing messages
            RegexPatterns.java             # Regex patterns
          interfaces/
            IBaseEntity.java               # Common interfaces
        dto/
          request/
            BaseRequestDto.java            # Pagination, search, sort
            CreateXRequestDto.java
            UpdateXRequestDto.java
            ListXQueryDto.java
          response/
            BaseResponseDto.java           # Standard response wrapper
            ResultResponseDto.java         # List response with pagination
            XResponseDto.java              # Entity responses
          mappers/
            XMapper.java                   # MapStruct mappers for DTOs
        model/
          BaseEntity.java                  # Abstract base with id, createdAt, updatedAt
          User.java
          Campaign.java
          ...
        repository/
          UserRepository.java              # Spring Data JPA + custom queries
          CampaignRepository.java
          ...
        service/
          UserService.java                 # Business logic, transactions
          CampaignService.java
          ...
        api/
          v1/
            controller/
              UserController.java          # HTTP endpoints
              CampaignController.java
            service/
              CampaignProcessingService.java
        security/
          JwtTokenProvider.java            # JWT handling
          CustomUserDetailsService.java    # User authentication
          RoleBasedAccessControl.java      # RBAC implementation
        exception/
          AppException.java                # Custom exceptions
          GlobalExceptionHandler.java      # Global @ControllerAdvice
        util/
          JpaUtil.java                     # Query builders, helpers
          AuditUtil.java                   # Audit logging helpers
    resources/
      application.yml
      application-dev.yml
      application-prod.yml
      db/
        migration/
          V1__Initial_schema.sql           # Flyway migrations
          V2__Add_indexes.sql
  test/
    java/
      com/yourcompany/
        integration/
          UserControllerIntegrationTest.java
        unit/
          UserServiceTest.java
```

---

## Entity Modeling Standards

### 1. Base Entity Class

**ALL entities MUST extend BaseEntity** with common fields:

```java
import jakarta.persistence.*;
import java.time.LocalDateTime;

@MappedSuperclass
public abstract class BaseEntity {
  
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "created_at", nullable = false, updatable = false)
  private LocalDateTime createdAt = LocalDateTime.now();

  @Column(name = "updated_at", nullable = false)
  private LocalDateTime updatedAt = LocalDateTime.now();

  @Column(name = "deleted_at", nullable = true)
  private LocalDateTime deletedAt;

  @PreUpdate
  protected void onUpdate() {
    this.updatedAt = LocalDateTime.now();
  }

  // Getters/Setters
  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  
  public LocalDateTime getCreatedAt() { return createdAt; }
  public LocalDateTime getUpdatedAt() { return updatedAt; }
  public LocalDateTime getDeletedAt() { return deletedAt; }
  public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }

  // Soft delete check
  @Transient
  public boolean isDeleted() {
    return deletedAt != null;
  }
}
```

### 2. Entity Definition Pattern

```java
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(
  name = "users",
  indexes = {
    @Index(name = "idx_email", columnList = "email_address", unique = true),
    @Index(name = "idx_status_created", columnList = "account_status,created_at"),
    @Index(name = "idx_role_id", columnList = "role_id"),
    @Index(name = "idx_active_users", columnList = "account_status", 
      where = "deleted_at IS NULL")  // Partial index for active records
  }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User extends BaseEntity {

  @Column(name = "email_address", nullable = false, length = 255)
  private String emailAddress;

  @Column(name = "first_name", nullable = false, length = 100)
  private String firstName;

  @Column(name = "last_name", nullable = false, length = 100)
  private String lastName;

  // Enum stored as VARCHAR with constraint
  @Column(name = "account_status", nullable = false, length = 50)
  @Enumerated(EnumType.STRING)
  private AccountStatus accountStatus = AccountStatus.ACTIVE;

  @Column(name = "fraud_risk_score", nullable = false)
  private Integer fraudRiskScore = 0;

  // Soft delete - no special annotation needed (check in queries)
  // Deleted records are excluded via WHERE deleted_at IS NULL in queries

  // Foreign key
  @Column(name = "role_id", nullable = true)
  private Long roleId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "role_id", insertable = false, updatable = false)
  private Role role;

  // JSONB column for semi-structured data (PostgreSQL)
  @Column(name = "metadata", columnDefinition = "jsonb")
  private Map<String, Object> metadata;

  // Indexed datetime columns for range queries
  @Column(name = "email_verified_at", nullable = true)
  private LocalDateTime emailVerifiedAt;

  // Password handling
  @Column(name = "password", nullable = false, length = 255)
  private String password;

  // Timestamp for business logic (e.g., last login)
  @Column(name = "last_login_at", nullable = true)
  private LocalDateTime lastLoginAt;
}
```

### 3. Indexing Rules

✅ **REQUIRED Indexes:**
- All foreign key columns
- All columns used in `WHERE` clauses
- All columns used in `ORDER BY`
- All columns used in `JOIN` conditions
- Date range columns used in filters
- Composite indexes for frequently co-queried columns

```java
// Single index
@Index(name = "idx_user_email", columnList = "email_address")

// Composite index (order matters - most selective first)
@Index(name = "idx_status_created", columnList = "account_status,created_at")

// Partial index (PostgreSQL - active records only)
@Index(name = "idx_active_users", columnList = "account_status", 
  where = "deleted_at IS NULL")

// Unique constraint
@Column(unique = true, nullable = false)
private String code;
```

### 4. Column Type Precision

```java
// ❌ WRONG - Uses float, imprecise for money
@Column
private Double amount;

// ✅ CORRECT - Precise decimal for financial data
@Column(name = "amount", columnDefinition = "NUMERIC(18,4)", nullable = false)
private BigDecimal amount;

// ✅ Enum stored as VARCHAR (not database enum)
@Column(name = "status", length = 50, nullable = false)
@Enumerated(EnumType.STRING)
private AccountStatus status;

// ✅ JSONB for semi-structured data
@Column(name = "config", columnDefinition = "jsonb", nullable = true)
@Type(JsonType.class)
private Map<String, Object> config;

// ✅ Timestamps using LocalDateTime (not Date)
@Column(name = "created_at", nullable = false, updatable = false)
private LocalDateTime createdAt = LocalDateTime.now();

// ✅ Bounded string length
@Column(name = "email", length = 255, nullable = false)
private String email;
```

### 5. Soft Delete Pattern

```java
// In BaseEntity or custom interface
@Column(name = "deleted_at", nullable = true)
private LocalDateTime deletedAt;

@Transient
public boolean isDeleted() {
  return deletedAt != null;
}

// Use in service layer
public void softDelete(Long id) {
  User user = userRepository.findById(id)
    .orElseThrow(() -> new EntityNotFoundException("User not found"));
  user.setDeletedAt(LocalDateTime.now());
  userRepository.save(user);
}

// Queries MUST include: WHERE deleted_at IS NULL
```

---

## Repository & Query Optimization

### 1. Spring Data JPA Repository Pattern

**CRITICAL: Never use `.findAll()` or `.save()` directly. Always use custom `@Query` with explicit field selection.**

```java
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

  // ❌ FORBIDDEN - These select all fields, create N+1 queries
  // List<User> findAll();
  // Optional<User> findById(Long id);

  // ✅ CORRECT - Explicit field selection, active records only
  @Query(
    "SELECT new com.yourcompany.dto.response.UserDto(u.id, u.emailAddress, u.firstName) " +
    "FROM User u " +
    "WHERE u.deletedAt IS NULL " +
    "AND u.accountStatus = 'ACTIVE' " +
    "ORDER BY u.createdAt DESC"
  )
  List<UserDto> findAllActiveUsers();

  // ✅ Find by indexed column with JPQL projection
  @Query(
    "SELECT u FROM User u " +
    "WHERE u.emailAddress = :email AND u.deletedAt IS NULL"
  )
  Optional<User> findByEmailAddress(@Param("email") String email);

  // ✅ Paginated list with search and sort
  @Query(
    "SELECT new com.yourcompany.dto.response.UserDto(" +
    "  u.id, u.emailAddress, u.firstName, u.lastName, u.accountStatus, u.createdAt) " +
    "FROM User u " +
    "WHERE u.deletedAt IS NULL " +
    "AND u.accountStatus IN :statuses " +
    "AND (LOWER(u.firstName) LIKE LOWER(CONCAT('%', :search, '%')) " +
    "  OR LOWER(u.emailAddress) LIKE LOWER(CONCAT('%', :search, '%'))) " +
    "ORDER BY u.createdAt DESC"
  )
  Page<UserDto> findUsers(
    @Param("statuses") List<AccountStatus> statuses,
    @Param("search") String search,
    Pageable pageable
  );

  // ✅ Count matching criteria
  @Query(
    "SELECT COUNT(u) FROM User u " +
    "WHERE u.deletedAt IS NULL " +
    "AND u.accountStatus = :status"
  )
  Long countByStatus(@Param("status") AccountStatus status);

  // ✅ Bulk operations
  @Modifying
  @Query(
    "UPDATE User u SET u.accountStatus = :status, u.updatedAt = :now " +
    "WHERE u.id IN :ids AND u.deletedAt IS NULL"
  )
  void updateStatusBulk(
    @Param("ids") List<Long> ids,
    @Param("status") AccountStatus status,
    @Param("now") LocalDateTime now
  );

  // ✅ Soft delete bulk
  @Modifying
  @Query(
    "UPDATE User u SET u.deletedAt = :now " +
    "WHERE u.id IN :ids AND u.deletedAt IS NULL"
  )
  void softDeleteBulk(
    @Param("ids") List<Long> ids,
    @Param("now") LocalDateTime now
  );
}
```

### 2. Custom Query Builder for Complex Queries

```java
@Repository
public class UserCustomRepository {

  @PersistenceContext
  private EntityManager em;

  /**
   * Build dynamic query with multiple filters
   */
  public Page<UserDto> searchUsers(UserSearchCriteria criteria, Pageable pageable) {
    CriteriaBuilder cb = em.getCriteriaBuilder();
    CriteriaQuery<UserDto> query = cb.createQuery(UserDto.class);
    Root<User> root = query.from(User.class);

    List<Predicate> predicates = new ArrayList<>();
    
    // Always filter out deleted records
    predicates.add(cb.isNull(root.get("deletedAt")));

    // Apply status filter
    if (criteria.getStatuses() != null && !criteria.getStatuses().isEmpty()) {
      predicates.add(root.get("accountStatus").in(criteria.getStatuses()));
    }

    // Apply search filter on multiple fields
    if (criteria.getSearch() != null && !criteria.getSearch().isEmpty()) {
      String searchTerm = "%" + criteria.getSearch().toLowerCase() + "%";
      predicates.add(cb.or(
        cb.like(cb.lower(root.get("firstName")), searchTerm),
        cb.like(cb.lower(root.get("emailAddress")), searchTerm)
      ));
    }

    // Apply date range
    if (criteria.getCreatedAfter() != null) {
      predicates.add(cb.greaterThanOrEqualTo(
        root.get("createdAt"), 
        criteria.getCreatedAfter()
      ));
    }

    // Combine predicates
    query.where(predicates.toArray(new Predicate[0]));

    // Apply sorting
    if (criteria.getOrderBy() != null) {
      Order order = criteria.getOrderBy().equals("DESC")
        ? cb.desc(root.get("createdAt"))
        : cb.asc(root.get("createdAt"));
      query.orderBy(order);
    }

    // Select specific fields (no SELECT *)
    query.select(cb.construct(UserDto.class,
      root.get("id"),
      root.get("emailAddress"),
      root.get("firstName"),
      root.get("createdAt")
    ));

    TypedQuery<UserDto> typedQuery = em.createQuery(query)
      .setFirstResult((int) pageable.getOffset())
      .setMaxResults(pageable.getPageSize());

    return new PageImpl<>(typedQuery.getResultList(), pageable, 
      getTotal(criteria));
  }

  private Long getTotal(UserSearchCriteria criteria) {
    CriteriaBuilder cb = em.getCriteriaBuilder();
    CriteriaQuery<Long> countQuery = cb.createQuery(Long.class);
    Root<User> root = countQuery.from(User.class);
    
    // Apply same filters as main query
    List<Predicate> predicates = new ArrayList<>();
    predicates.add(cb.isNull(root.get("deletedAt")));
    if (criteria.getStatuses() != null) {
      predicates.add(root.get("accountStatus").in(criteria.getStatuses()));
    }
    
    countQuery.select(cb.count(root))
      .where(predicates.toArray(new Predicate[0]));
    
    return em.createQuery(countQuery).getSingleResult();
  }
}
```

### 3. Query Rules (Non-Negotiable)

✅ **REQUIRED:**
- Always select explicit fields: `.select(...)` or JPQL projection
- Always filter soft-deleted records: `WHERE deletedAt IS NULL`
- Always use indexed columns in WHERE/ORDER BY/JOIN
- Always paginate list queries: `Pageable` or `LIMIT/OFFSET`
- Always use named parameters: `@Param("name")`
- Always use `Modifying` for UPDATE/DELETE: `@Modifying @Query`

❌ **FORBIDDEN:**
- `findAll()` without filters
- `SELECT *` or unselected JPQL
- N+1 queries (use `@Query` with JOINs or fetch strategies)
- Unbounded result sets
- Hard-coded pagination limits
- Inline JPQL (always use `@Query` annotation)

---

## Service Layer Standards

### 1. Service Class Structure

```java
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class UserService {

  private final UserRepository userRepository;
  private final RoleRepository roleRepository;
  private final PasswordEncoder passwordEncoder;
  private final AuditService auditService;

  /**
   * Constructor injection via @RequiredArgsConstructor
   * All fields are final and private
   */

  // Service methods
}
```

**Requirements:**
- ✅ `@Service` annotation
- ✅ `@Transactional` on class (applies to all public methods)
- ✅ `@RequiredArgsConstructor` for constructor injection (no @Autowired)
- ✅ `@Slf4j` for logging (never use System.out.println)
- ✅ All injected fields are `private final`

### 2. CRUD Service Pattern

```java
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class UserService {

  private final UserRepository userRepository;
  private final UserMapper userMapper;
  private final AuditService auditService;

  // CREATE
  public UserResponseDto createUser(CreateUserRequestDto dto) {
    // Validate input
    if (userRepository.findByEmailAddress(dto.getEmailAddress()).isPresent()) {
      throw new ConflictException("Email already registered");
    }

    // Create entity
    User user = User.builder()
      .emailAddress(dto.getEmailAddress())
      .firstName(dto.getFirstName())
      .lastName(dto.getLastName())
      .password(passwordEncoder.encode(dto.getPassword()))
      .accountStatus(AccountStatus.ACTIVE)
      .build();

    // Save
    User saved = userRepository.save(user);

    // Audit log
    auditService.log("USER_CREATED", "User created: " + saved.getId());

    log.info("User created: {}", saved.getId());
    return userMapper.toResponseDto(saved);
  }

  // READ
  public UserResponseDto getUserById(Long id) {
    User user = userRepository.findById(id)
      .orElseThrow(() -> new EntityNotFoundException("User not found"));
    return userMapper.toResponseDto(user);
  }

  // UPDATE
  public UserResponseDto updateUser(Long id, UpdateUserRequestDto dto) {
    User user = userRepository.findById(id)
      .orElseThrow(() -> new EntityNotFoundException("User not found"));

    // Apply updates (only non-null fields)
    if (dto.getFirstName() != null) {
      user.setFirstName(dto.getFirstName());
    }
    if (dto.getLastName() != null) {
      user.setLastName(dto.getLastName());
    }

    User updated = userRepository.save(user);
    auditService.log("USER_UPDATED", "User updated: " + updated.getId());

    log.info("User updated: {}", updated.getId());
    return userMapper.toResponseDto(updated);
  }

  // DELETE (Soft Delete)
  public void deleteUser(Long id) {
    User user = userRepository.findById(id)
      .orElseThrow(() -> new EntityNotFoundException("User not found"));

    user.setDeletedAt(LocalDateTime.now());
    userRepository.save(user);

    auditService.log("USER_DELETED", "User soft-deleted: " + id);
    log.info("User soft-deleted: {}", id);
  }

  // LIST with pagination
  public Page<UserResponseDto> listUsers(
    ListUserRequestDto searchCriteria,
    Pageable pageable
  ) {
    Page<User> users = userRepository.findUsers(
      searchCriteria.getStatuses(),
      searchCriteria.getSearch(),
      pageable
    );
    return users.map(userMapper::toResponseDto);
  }
}
```

### 3. Explicit Transaction Management

**CRITICAL: Use explicit transaction handling with manual commit/rollback. Never rely on @Transactional auto-rollback.**

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class CampaignService {

  private final CampaignRepository campaignRepository;
  private final CampaignRecipientRepository recipientRepository;
  private final PlatformTransactionManager transactionManager;
  private final AuditService auditService;

  /**
   * Process campaign with explicit transaction control
   */
  public void processCampaign(Long campaignId, Long adminUserId) {
    // Create transaction definition
    DefaultTransactionDefinition def = new DefaultTransactionDefinition();
    def.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
    def.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);

    TransactionStatus status = transactionManager.getTransaction(def);

    try {
      Campaign campaign = campaignRepository.findById(campaignId)
        .orElseThrow(() -> new EntityNotFoundException("Campaign not found"));

      // Update campaign status
      campaign.setStatus(CampaignStatus.PROCESSING);
      campaign.setProcessingStartedAt(LocalDateTime.now());
      campaignRepository.save(campaign);

      // Create recipients in batch
      List<CampaignRecipient> recipients = new ArrayList<>();
      for (User user : findAudienceUsers(campaign)) {
        recipients.add(CampaignRecipient.builder()
          .campaignId(campaign.getId())
          .userId(user.getId())
          .status(RecipientStatus.PENDING)
          .build());
      }
      recipientRepository.saveAll(recipients);

      // Log audit action (MUST use AuditAction enum)
      auditService.log(
        AuditAction.CAMPAIGN_PROCESSING_STARTED,
        "Campaign processing initiated: " + campaignId,
        campaignId,
        "CAMPAIGN"
      );

      // Explicit commit
      transactionManager.commit(status);
      log.info("Campaign processed successfully: {}", campaignId);

    } catch (Exception e) {
      // Explicit rollback on error
      transactionManager.rollback(status);
      log.error("Failed to process campaign: {}", campaignId, e);
      
      // Log the failure (MUST use AuditAction enum)
      auditService.log(
        AuditAction.CAMPAIGN_PROCESSING_FAILED,
        "Campaign processing failed: " + e.getMessage(),
        campaignId,
        "CAMPAIGN"
      );
      
      throw new InternalServerErrorException("Campaign processing failed: " + e.getMessage());
    }
  }

  /**
   * Batch operation with explicit transaction handling
   */
  public void updateCampaignsBulk(List<Long> campaignIds, CampaignStatus status) {
    DefaultTransactionDefinition def = new DefaultTransactionDefinition();
    def.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);

    TransactionStatus txStatus = transactionManager.getTransaction(def);

    try {
      // Bulk update
      campaignRepository.updateStatusBulk(campaignIds, status, LocalDateTime.now());

      // Audit each campaign
      for (Long campaignId : campaignIds) {
        auditService.log(
          AuditAction.CAMPAIGN_STATUS_CHANGED,
          "Campaign status updated to: " + status,
          campaignId,
          "CAMPAIGN"
        );
      }

      transactionManager.commit(txStatus);
      log.info("Bulk campaign update completed: {} records", campaignIds.size());

    } catch (Exception e) {
      transactionManager.rollback(txStatus);
      log.error("Bulk campaign update failed", e);
      throw new InternalServerErrorException("Bulk update failed: " + e.getMessage());
    }
  }

  // ❌ WRONG - Implicit transaction handling
  @Transactional
  public void badProcessing(Long campaignId) {
    Campaign campaign = campaignRepository.findById(campaignId).orElseThrow();
    campaign.setStatus(CampaignStatus.PROCESSING);
    campaignRepository.save(campaign);
    // No explicit commit/rollback - hidden from code!
  }
}
```

**Transaction Rules:**
- ✅ Always create `DefaultTransactionDefinition` with propagation and isolation levels
- ✅ Explicit `transactionManager.getTransaction(def)` to begin
- ✅ Explicit `transactionManager.commit(status)` on success
- ✅ Explicit `transactionManager.rollback(status)` in catch block
- ✅ All audit logging uses `AuditAction` enum (never hardcoded strings)
- ✅ Clear error logging before rollback
- ❌ Never use `@Transactional` for critical operations
- ❌ Never hardcode audit log action strings

### 4. Error Handling in Service

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

  // ✅ Specific exceptions with clear messages
  public UserResponseDto authenticateUser(String email, String password) {
    User user = userRepository.findByEmailAddress(email)
      .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

    if (!passwordEncoder.matches(password, user.getPassword())) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.getAccountStatus() == AccountStatus.LOCKED) {
      throw new ConflictException("Account is locked");
    }

    return userMapper.toResponseDto(user);
  }

  public void updateUserRole(Long userId, Long roleId) {
    User user = userRepository.findById(userId)
      .orElseThrow(() -> new EntityNotFoundException("User not found"));

    Role role = roleRepository.findById(roleId)
      .orElseThrow(() -> new EntityNotFoundException("Role not found"));

    user.setRole(role);
    userRepository.save(user);
  }
}
```

---

## Controller/REST Standards

### 1. REST Controller Structure

```java
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "User Management", description = "User endpoints")
@SecurityRequirement(name = "bearer-jwt")
@RequiredArgsConstructor
@Slf4j
public class UserController {

  private final UserService userService;

  // GET - Retrieve resource
  @GetMapping("/{id}")
  @Operation(summary = "Get user by ID")
  public ResponseEntity<BaseResponseDto<UserResponseDto>> getUserById(
    @PathVariable Long id
  ) {
    UserResponseDto user = userService.getUserById(id);
    return ResponseEntity.ok(
      BaseResponseDto.success("User retrieved successfully", user)
    );
  }

  // GET - List with pagination
  @GetMapping
  @Operation(summary = "List users with search and pagination")
  public ResponseEntity<BaseResponseDto<Page<UserResponseDto>>> listUsers(
    @Valid ListUserRequestDto searchCriteria,
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size,
    @RequestParam(defaultValue = "DESC") String order
  ) {
    Pageable pageable = PageRequest.of(page, size, 
      Sort.Direction.fromString(order), "createdAt");
    Page<UserResponseDto> users = userService.listUsers(searchCriteria, pageable);
    
    return ResponseEntity.ok(
      BaseResponseDto.success("Users retrieved successfully", users)
    );
  }

  // POST - Create resource
  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(summary = "Create new user")
  public ResponseEntity<BaseResponseDto<UserResponseDto>> createUser(
    @Valid @RequestBody CreateUserRequestDto dto
  ) {
    UserResponseDto user = userService.createUser(dto);
    return ResponseEntity.status(HttpStatus.CREATED)
      .body(BaseResponseDto.success("User created successfully", user));
  }

  // PATCH - Partial update
  @PatchMapping("/{id}")
  @Operation(summary = "Update user")
  public ResponseEntity<BaseResponseDto<UserResponseDto>> updateUser(
    @PathVariable Long id,
    @Valid @RequestBody UpdateUserRequestDto dto
  ) {
    UserResponseDto user = userService.updateUser(id, dto);
    return ResponseEntity.ok(
      BaseResponseDto.success("User updated successfully", user)
    );
  }

  // DELETE - Remove resource
  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(summary = "Delete user (soft delete)")
  public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
    userService.deleteUser(id);
    return ResponseEntity.noContent().build();
  }
}
```

### 2. REST Endpoint Standards

✅ **CORRECT URL Patterns:**
```
GET    /api/v1/users               # List
POST   /api/v1/users               # Create
GET    /api/v1/users/{id}          # Get one
PATCH  /api/v1/users/{id}          # Update
DELETE /api/v1/users/{id}          # Delete

GET    /api/v1/users/me             # Current user
PATCH  /api/v1/users/me             # Update current user
POST   /api/v1/users/me/password    # Change password
```

❌ **WRONG Patterns:**
```
GET    /api/v1/getUser              # No verbs in URLs
POST   /api/v1/createUser           # Verb is in HTTP method
POST   /api/v1/users/{id}/delete    # Use DELETE method
GET    /api/v1/getUserById          # Use path param instead
```

### 3. HTTP Status Codes

```java
// ✅ Success responses
@PostMapping
@ResponseStatus(HttpStatus.CREATED)       // 201 - Created
public UserResponseDto create(@RequestBody CreateUserRequestDto dto) { ... }

@GetMapping("/{id}")
@ResponseStatus(HttpStatus.OK)             // 200 - OK (default)
public UserResponseDto getById(@PathVariable Long id) { ... }

@DeleteMapping("/{id}")
@ResponseStatus(HttpStatus.NO_CONTENT)     // 204 - No Content
public void delete(@PathVariable Long id) { ... }

// ✅ Error responses (thrown by GlobalExceptionHandler)
@GetMapping("/{id}")
public UserResponseDto getById(@PathVariable Long id) {
  return userService.getUserById(id);
  // Throws EntityNotFoundException → 404
}

@PostMapping
public UserResponseDto create(@RequestBody CreateUserRequestDto dto) {
  return userService.createUser(dto);
  // Throws ConflictException → 409
}
```

---

## DTO Standards

### 1. Request DTO Pattern

```java
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import com.yourcompany.validation.IsStrongPassword;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateUserRequestDto {

  @Schema(description = "User email address", example = "user@example.com")
  @NotEmpty(message = "Email is required")
  @Email(message = "Email format is invalid")
  private String emailAddress;

  @Schema(description = "User first name", example = "John")
  @NotEmpty(message = "First name is required")
  @Size(min = 2, max = 100, message = "First name must be 2-100 characters")
  private String firstName;

  @Schema(description = "User last name", example = "Doe")
  @NotEmpty(message = "Last name is required")
  @Size(min = 2, max = 100)
  private String lastName;

  @Schema(description = "User password", example = "SecurePass123!")
  @NotEmpty(message = "Password is required")
  @IsStrongPassword(message = "Password must be strong")
  private String password;

  @Schema(description = "Account type", example = "USER")
  @NotNull(message = "Account type is required")
  private AccountType accountType;

  // ✅ Validation annotations on EVERY field
  // ✅ Swagger documentation for EVERY field
  // ✅ Error messages are user-friendly
  // ✅ Use custom validators for complex validation
}
```

### 2. Response DTO Pattern

```java
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonInclude;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UserResponseDto {

  @Schema(description = "User ID", example = "1")
  @JsonProperty("user_id")
  private Long id;

  @Schema(description = "User email address", example = "user@example.com")
  private String emailAddress;

  @Schema(description = "User first name", example = "John")
  private String firstName;

  @Schema(description = "User last name", example = "Doe")
  private String lastName;

  @Schema(description = "Account status", example = "ACTIVE")
  private String accountStatus;

  @Schema(description = "Creation timestamp")
  private LocalDateTime createdAt;

  // ✅ NO sensitive fields (password, tokenVersion, etc.)
  // ✅ Renamed fields (id → user_id) to avoid exposing internal structure
  // ✅ Swagger documentation for EVERY field
  // ❌ NEVER include: password, twoFactorSecret, transactionPin, tokenVersion
}
```

### 3. Base Request/Response DTOs

```java
// Base Request DTO for list endpoints
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BaseRequestDto {

  @Schema(description = "Search term", example = "john")
  private String search;

  @Schema(description = "Page number (0-indexed)", example = "0")
  @Min(0)
  private Integer page = 0;

  @Schema(description = "Records per page", example = "20")
  @Min(1)
  @Max(100)
  private Integer size = 20;

  @Schema(description = "Sort order", example = "DESC", allowableValues = {"ASC", "DESC"})
  private String order = "DESC";
}

// Base Response DTO
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BaseResponseDto<T> {

  @Schema(description = "Response status", example = "true")
  private Boolean status;

  @Schema(description = "Response message", example = "Operation successful")
  private String message;

  @Schema(description = "Response data")
  private T data;

  // Static factory methods
  public static <T> BaseResponseDto<T> success(String message, T data) {
    return BaseResponseDto.<T>builder()
      .status(true)
      .message(message)
      .data(data)
      .build();
  }

  public static <T> BaseResponseDto<T> error(String message) {
    return BaseResponseDto.<T>builder()
      .status(false)
      .message(message)
      .build();
  }
}
```

### 4. MapStruct Mapper Pattern

```java
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(
  componentModel = "spring",
  unmappedTargetPolicy = ReportingPolicy.IGNORE,
  unmappedSourcePolicy = ReportingPolicy.IGNORE
)
public interface UserMapper {

  @Mapping(source = "id", target = "userId")
  @Mapping(source = "createdAt", target = "createdAt")
  UserResponseDto toResponseDto(User entity);

  @Mapping(target = "password", ignore = true)  // Exclude sensitive fields
  User toEntity(CreateUserRequestDto dto);

  List<UserResponseDto> toResponseDtos(List<User> entities);
}
```

---

## Security Standards

### 1. Authentication Configuration

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class SecurityConfig {

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(10);  // Strength 10
  }

  @Bean
  public AuthenticationManager authenticationManager(
    AuthenticationConfiguration config
  ) throws Exception {
    return config.getAuthenticationManager();
  }

  @Bean
  public DaoAuthenticationProvider authenticationProvider(
    UserDetailsService userDetailsService,
    PasswordEncoder passwordEncoder
  ) {
    DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
    authProvider.setUserDetailsService(userDetailsService);
    authProvider.setPasswordEncoder(passwordEncoder);
    return authProvider;
  }
}
```

### 2. JWT Token Provider

```java
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;

@Component
@Slf4j
public class JwtTokenProvider {

  @Value("${app.jwt.secret}")
  private String jwtSecret;

  @Value("${app.jwt.expiration-ms:86400000}")  // 24 hours
  private long jwtExpirationMs;

  private SecretKey key() {
    return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
  }

  /**
   * Generate JWT token
   */
  public String generateToken(Long userId, String email) {
    return Jwts.builder()
      .setSubject(email)
      .claim("userId", userId)
      .setIssuedAt(new Date())
      .setExpiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
      .signWith(key(), SignatureAlgorithm.HS256)
      .compact();
  }

  /**
   * Extract user ID from token
   */
  public Long extractUserId(String token) {
    return Jwts.parserBuilder()
      .setSigningKey(key())
      .build()
      .parseClaimsJws(token)
      .getBody()
      .get("userId", Long.class);
  }

  /**
   * Validate token
   */
  public boolean validateToken(String token) {
    try {
      Jwts.parserBuilder()
        .setSigningKey(key())
        .build()
        .parseClaimsJws(token);
      return true;
    } catch (JwtException | IllegalArgumentException e) {
      log.error("JWT validation failed", e);
      return false;
    }
  }

  /**
   * Extract email from token
   */
  public String extractEmail(String token) {
    return Jwts.parserBuilder()
      .setSigningKey(key())
      .build()
      .parseClaimsJws(token)
      .getBody()
      .getSubject();
  }
}
```

### 3. Password Handling

```java
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
@RequiredArgsConstructor
public class UserService {

  private final PasswordEncoder passwordEncoder;

  // Hash password before storage
  public void setPassword(User user, String plainPassword) {
    user.setPassword(passwordEncoder.encode(plainPassword));
  }

  // Verify password
  public boolean verifyPassword(String plainPassword, String hashedPassword) {
    return passwordEncoder.matches(plainPassword, hashedPassword);
  }
}
```

### 4. Sensitive Data Exclusion

✅ **NEVER include in responses:**
- `password`
- `twoFactorSecret`
- `transactionPin`
- `tokenVersion`
- Any internal system fields

```java
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UserResponseDto {
  private Long id;
  private String emailAddress;
  private String firstName;
  
  // ✅ Getters for safe fields only
  // ❌ NO password, NO secrets, NO internal tokens
}
```

---

## Error Handling

### 1. Custom Exception Classes

```java
// Base exception
public abstract class AppException extends RuntimeException {
  public AppException(String message) {
    super(message);
  }
  
  public AppException(String message, Throwable cause) {
    super(message, cause);
  }

  public abstract HttpStatus getStatus();
}

// Specific exceptions
public class EntityNotFoundException extends AppException {
  public EntityNotFoundException(String message) {
    super(message);
  }

  @Override
  public HttpStatus getStatus() {
    return HttpStatus.NOT_FOUND;  // 404
  }
}

public class ConflictException extends AppException {
  public ConflictException(String message) {
    super(message);
  }

  @Override
  public HttpStatus getStatus() {
    return HttpStatus.CONFLICT;  // 409
  }
}

public class UnauthorizedException extends AppException {
  public UnauthorizedException(String message) {
    super(message);
  }

  @Override
  public HttpStatus getStatus() {
    return HttpStatus.UNAUTHORIZED;  // 401
  }
}

public class BadRequestException extends AppException {
  public BadRequestException(String message) {
    super(message);
  }

  @Override
  public HttpStatus getStatus() {
    return HttpStatus.BAD_REQUEST;  // 400
  }
}
```

### 2. Global Exception Handler

```java
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import lombok.extern.slf4j.Slf4j;

@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

  // Handle custom app exceptions
  @ExceptionHandler(AppException.class)
  public ResponseEntity<BaseResponseDto<?>> handleAppException(AppException ex) {
    log.warn("Application exception: {}", ex.getMessage());
    return ResponseEntity
      .status(ex.getStatus())
      .body(BaseResponseDto.error(ex.getMessage()));
  }

  // Handle validation errors
  @ExceptionHandler(MethodArgumentNotValidException.class)
  @ResponseStatus(HttpStatus.BAD_REQUEST)
  public ResponseEntity<BaseResponseDto<?>> handleValidationException(
    MethodArgumentNotValidException ex
  ) {
    String message = ex.getBindingResult()
      .getAllErrors()
      .stream()
      .map(error -> error.getDefaultMessage())
      .collect(Collectors.joining(", "));

    log.warn("Validation error: {}", message);
    return ResponseEntity
      .status(HttpStatus.BAD_REQUEST)
      .body(BaseResponseDto.error("Validation failed: " + message));
  }

  // Handle database constraint violations
  @ExceptionHandler(DataIntegrityViolationException.class)
  @ResponseStatus(HttpStatus.CONFLICT)
  public ResponseEntity<BaseResponseDto<?>> handleDataIntegrityViolation(
    DataIntegrityViolationException ex
  ) {
    log.error("Data integrity violation", ex);
    return ResponseEntity
      .status(HttpStatus.CONFLICT)
      .body(BaseResponseDto.error("Record already exists or constraint violated"));
  }

  // Generic exception handler
  @ExceptionHandler(Exception.class)
  @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
  public ResponseEntity<BaseResponseDto<?>> handleGenericException(Exception ex) {
    log.error("Unexpected error", ex);
    return ResponseEntity
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .body(BaseResponseDto.error("An unexpected error occurred"));
  }
}
```

---

## Audit Logging

### 1. Audit Action Enum (CRITICAL - NO HARDCODED STRINGS)

**✅ CRITICAL: All audit actions MUST be defined as enums. NEVER hardcode action strings.**

```java
public enum AuditAction {
  // User actions
  USER_CREATED("User account created"),
  USER_UPDATED("User account updated"),
  USER_DELETED("User account deleted"),
  USER_STATUS_CHANGED("User account status changed"),
  USER_PASSWORD_CHANGED("User password changed"),
  USER_ROLE_ASSIGNED("User role assigned"),
  USER_LOCKED("User account locked"),
  USER_UNLOCKED("User account unlocked"),

  // Campaign actions
  CAMPAIGN_CREATED("Campaign created"),
  CAMPAIGN_UPDATED("Campaign updated"),
  CAMPAIGN_DELETED("Campaign deleted"),
  CAMPAIGN_SCHEDULED("Campaign scheduled for delivery"),
  CAMPAIGN_SENT("Campaign sent to recipients"),
  CAMPAIGN_CANCELLED("Campaign cancelled"),
  CAMPAIGN_PROCESSING_STARTED("Campaign processing started"),
  CAMPAIGN_PROCESSING_FAILED("Campaign processing failed"),
  CAMPAIGN_PROCESSING_COMPLETED("Campaign processing completed"),
  CAMPAIGN_STATUS_CHANGED("Campaign status changed"),

  // Authentication actions
  LOGIN_SUCCESS("User login successful"),
  LOGIN_FAILED("User login failed"),
  LOGOUT("User logout"),
  PASSWORD_RESET_REQUESTED("Password reset requested"),
  PASSWORD_RESET_COMPLETED("Password reset completed"),
  TWO_FACTOR_ENABLED("Two-factor authentication enabled"),
  TWO_FACTOR_DISABLED("Two-factor authentication disabled"),

  // Permission/Role actions
  PERMISSION_GRANTED("Permission granted"),
  PERMISSION_REVOKED("Permission revoked"),
  ROLE_CREATED("Role created"),
  ROLE_UPDATED("Role updated"),
  ROLE_DELETED("Role deleted"),

  // Data operations
  BULK_UPDATE("Bulk update operation"),
  BULK_DELETE("Bulk delete operation"),
  DATA_EXPORT("Data exported"),
  DATA_IMPORT("Data imported");

  private final String description;

  AuditAction(String description) {
    this.description = description;
  }

  public String getDescription() {
    return description;
  }
}
```

### 2. Audit Log Entity

```java
@Entity
@Table(name = "audit_logs", indexes = {
  @Index(name = "idx_user_id_created", columnList = "user_id,created_at"),
  @Index(name = "idx_action_created", columnList = "action,created_at"),
  @Index(name = "idx_resource_id_type", columnList = "resource_id,resource_type")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog extends BaseEntity {

  @Column(name = "user_id", nullable = false)
  private Long userId;

  // Store enum as VARCHAR
  @Column(name = "action", nullable = false, length = 100)
  @Enumerated(EnumType.STRING)
  private AuditAction action;

  @Column(name = "description", columnDefinition = "TEXT")
  private String description;

  @Column(name = "ip_address", length = 50)
  private String ipAddress;

  @Column(name = "resource_id", nullable = true)
  private Long resourceId;

  @Column(name = "resource_type", length = 100, nullable = true)
  private String resourceType;

  // HTTP status code if applicable
  @Column(name = "http_status_code", nullable = true)
  private Integer httpStatusCode;

  // Additional metadata as JSONB
  @Column(name = "metadata", columnDefinition = "jsonb", nullable = true)
  private Map<String, Object> metadata;
}
```

### 3. Audit Service

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

  private final AuditLogRepository auditLogRepository;
  private final HttpServletRequest request;

  /**
   * Log audit action with enum (REQUIRED - NO STRINGS)
   */
  public void log(AuditAction action, String description) {
    log(action, description, null, null);
  }

  /**
   * Log audit action with resource tracking
   */
  public void log(
    AuditAction action,
    String description,
    Long resourceId,
    String resourceType
  ) {
    logWithMetadata(action, description, resourceId, resourceType, null);
  }

  /**
   * Log with additional metadata
   */
  public void logWithMetadata(
    AuditAction action,
    String description,
    Long resourceId,
    String resourceType,
    Map<String, Object> metadata
  ) {
    try {
      AuditLog auditLog = AuditLog.builder()
        .userId(getCurrentUserId())
        .action(action)  // ✅ Enum, not string!
        .description(description)
        .ipAddress(getClientIpAddress())
        .resourceId(resourceId)
        .resourceType(resourceType)
        .httpStatusCode(getHttpStatusCode())
        .metadata(metadata)
        .build();

      auditLogRepository.save(auditLog);
      log.debug("Audit log saved: {} by user {}", action.name(), getCurrentUserId());

    } catch (Exception e) {
      log.error("Failed to save audit log for action: {}", action.name(), e);
      // Don't fail the main operation if audit logging fails
    }
  }

  private Long getCurrentUserId() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth instanceof JwtAuthenticationToken) {
      return ((JwtAuthenticationToken) auth).getUserId();
    }
    return null;
  }

  private String getClientIpAddress() {
    String xForwardedFor = request.getHeader("X-Forwarded-For");
    if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
      return xForwardedFor.split(",")[0];
    }
    return request.getRemoteAddr();
  }

  private Integer getHttpStatusCode() {
    try {
      return (Integer) request.getAttribute("javax.servlet.error.status_code");
    } catch (Exception e) {
      return null;
    }
  }
}
```

### 4. Usage in Service (With Explicit Transactions)

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

  private final UserRepository userRepository;
  private final AuditService auditService;
  private final PlatformTransactionManager transactionManager;

  public UserResponseDto createUser(CreateUserRequestDto dto) {
    DefaultTransactionDefinition def = new DefaultTransactionDefinition();
    def.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);

    TransactionStatus status = transactionManager.getTransaction(def);

    try {
      User user = User.builder()
        .emailAddress(dto.getEmailAddress())
        .firstName(dto.getFirstName())
        .build();

      User saved = userRepository.save(user);

      // ✅ Use AuditAction enum, NEVER hardcode strings
      auditService.log(
        AuditAction.USER_CREATED,  // Enum!
        "New user registered with email: " + dto.getEmailAddress(),
        saved.getId(),
        "USER"
      );

      transactionManager.commit(status);
      log.info("User created successfully: {}", saved.getId());
      return userMapper.toResponseDto(saved);

    } catch (Exception e) {
      transactionManager.rollback(status);
      log.error("Failed to create user", e);
      auditService.log(
        AuditAction.USER_CREATED,  // Enum for failure too
        "User creation failed: " + e.getMessage()
      );
      throw new InternalServerErrorException("User creation failed");
    }
  }
}
```

---

## Database Migrations

**CRITICAL: Use Liquibase CLI, NOT Flyway. Never use auto-migration (Hibernate ddl-auto).**

### 1. Project Structure

```
src/main/resources/
  db/
    liquibase/
      changelog-master.xml          # Master changelog
      migrations/
        2024-01-01-01-create-users.xml
        2024-01-01-02-create-audit-logs.xml
        2024-01-05-01-add-campaign-tables.xml
```

### 2. Master Changelog (changelog-master.xml)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
  xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
  http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-latest.xsd">

  <!-- Include all migration files -->
  <include file="db/liquibase/migrations/2024-01-01-01-create-users.xml"/>
  <include file="db/liquibase/migrations/2024-01-01-02-create-audit-logs.xml"/>
  <include file="db/liquibase/migrations/2024-01-05-01-add-campaign-tables.xml"/>

</databaseChangeLog>
```

### 3. Spring Boot Configuration (application.yml)

```yaml
spring:
  liquibase:
    enabled: true
    change-log: classpath:db/liquibase/changelog-master.xml
    contexts: dev,prod
    default-schema: public
    liquibase-schema: public

  jpa:
    hibernate:
      ddl-auto: validate  # NEVER use 'create' or 'update'
    show-sql: false
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        format_sql: true
```

### 4. Liquibase CLI Setup & Usage

```bash
# Install Liquibase (macOS)
brew install liquibase

# Verify installation
liquibase --version

# Create liquibase.properties in project root
cat > liquibase.properties << EOF
url=jdbc:postgresql://localhost:5432/nexa_prime
username=postgres
password=your_password
driver=org.postgresql.Driver
changeLogFile=src/main/resources/db/liquibase/changelog-master.xml
contexts=dev
EOF

# Liquibase CLI Commands (ALWAYS use CLI, never auto-apply)

# 1. Check current status
liquibase status

# 2. Preview SQL before applying (ALWAYS review)
liquibase updateSQL > migration-preview.sql
cat migration-preview.sql  # Review carefully!

# 3. Apply pending migrations
liquibase update

# 4. Tag database for rollback points
liquibase tag --tag=v1.0.0

# 5. Rollback to specific tag
liquibase rollback --tag=v1.0.0

# 6. Rollback last N migrations
liquibase rollbackCount --count=1

# 7. Rollback database to a specific date
liquibase rollbackToDate --date=2024-01-15

# 8. History of executed migrations
liquibase history
```

### 5. Migration Example: Create Users Table

**File: `migrations/2024-01-01-01-create-users.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
  xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
  http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-latest.xsd">

  <changeSet id="001-create-users-table" author="dev-team">
    <createTable tableName="users">
      <column name="id" type="BIGINT" autoIncrement="true">
        <constraints primaryKey="true" nullable="false"/>
      </column>
      <column name="email_address" type="VARCHAR(255)">
        <constraints nullable="false" unique="true" uniqueConstraintName="uk_user_email"/>
      </column>
      <column name="first_name" type="VARCHAR(100)">
        <constraints nullable="false"/>
      </column>
      <column name="last_name" type="VARCHAR(100)">
        <constraints nullable="false"/>
      </column>
      <column name="password" type="VARCHAR(255)">
        <constraints nullable="false"/>
      </column>
      <column name="account_status" type="VARCHAR(50)" defaultValue="ACTIVE">
        <constraints nullable="false"/>
      </column>
      <column name="fraud_risk_score" type="INT" defaultValue="0">
        <constraints nullable="false"/>
      </column>
      <column name="role_id" type="BIGINT"/>
      <column name="metadata" type="JSONB"/>
      <column name="email_verified_at" type="TIMESTAMP"/>
      <column name="last_login_at" type="TIMESTAMP"/>
      <column name="created_at" type="TIMESTAMP" defaultValueDate="CURRENT_TIMESTAMP">
        <constraints nullable="false"/>
      </column>
      <column name="updated_at" type="TIMESTAMP" defaultValueDate="CURRENT_TIMESTAMP">
        <constraints nullable="false"/>
      </column>
      <column name="deleted_at" type="TIMESTAMP"/>
    </createTable>

    <addForeignKeyConstraint
      constraintName="fk_user_role"
      baseTableName="users"
      baseColumnNames="role_id"
      referencedTableName="roles"
      referencedColumnNames="id"/>

    <createIndex indexName="idx_user_email" tableName="users">
      <column name="email_address"/>
    </createIndex>

    <createIndex indexName="idx_user_status_created" tableName="users">
      <column name="account_status"/>
      <column name="created_at"/>
    </createIndex>

    <sql>
      CREATE INDEX idx_user_active ON users(account_status) WHERE deleted_at IS NULL;
    </sql>
  </changeSet>

</databaseChangeLog>
```

### 6. Maven Dependencies

```xml
<dependency>
  <groupId>org.liquibase</groupId>
  <artifactId>liquibase-core</artifactId>
  <version>4.24.0</version>
</dependency>
<dependency>
  <groupId>org.postgresql</groupId>
  <artifactId>postgresql</artifactId>
  <version>42.7.1</version>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
```

### 7. Best Practices

✅ **REQUIRED:**
- Always use Liquibase CLI for migrations
- Review generated SQL before applying (`liquibase updateSQL`)
- Tag database before deployments (`liquibase tag`)
- One logical change per changeset
- Include author name in every changeset
- Test migrations locally first
- Keep migrations in version control
- Never hand-edit migration files

❌ **FORBIDDEN:**
- Hibernate `ddl-auto: create` or `update`
- Manual SQL execution
- Mixing migration tools
- Modifying committed changesets
- Auto-applying migrations to production
- Flyway or other migration tools

---



## Testing Standards

### 1. Unit Test Pattern

```java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("User Service Unit Tests")
class UserServiceTest {

  @Mock
  private UserRepository userRepository;

  @Mock
  private PasswordEncoder passwordEncoder;

  @InjectMocks
  private UserService userService;

  @Test
  @DisplayName("Should create user successfully")
  void testCreateUserSuccess() {
    // Arrange
    CreateUserRequestDto dto = CreateUserRequestDto.builder()
      .emailAddress("test@example.com")
      .firstName("John")
      .lastName("Doe")
      .password("securePassword123")
      .build();

    when(userRepository.findByEmailAddress("test@example.com"))
      .thenReturn(Optional.empty());
    when(passwordEncoder.encode("securePassword123"))
      .thenReturn("hashed_password");

    User savedUser = User.builder()
      .id(1L)
      .emailAddress("test@example.com")
      .firstName("John")
      .lastName("Doe")
      .build();

    when(userRepository.save(any(User.class))).thenReturn(savedUser);

    // Act
    UserResponseDto result = userService.createUser(dto);

    // Assert
    assertNotNull(result);
    assertEquals("test@example.com", result.getEmailAddress());
    assertEquals("John", result.getFirstName());
    verify(userRepository, times(1)).save(any(User.class));
  }

  @Test
  @DisplayName("Should throw ConflictException when email already exists")
  void testCreateUserEmailConflict() {
    // Arrange
    CreateUserRequestDto dto = CreateUserRequestDto.builder()
      .emailAddress("existing@example.com")
      .firstName("John")
      .build();

    User existingUser = User.builder()
      .id(1L)
      .emailAddress("existing@example.com")
      .build();

    when(userRepository.findByEmailAddress("existing@example.com"))
      .thenReturn(Optional.of(existingUser));

    // Act & Assert
    assertThrows(ConflictException.class, () -> userService.createUser(dto));
  }
}
```

### 2. Integration Test Pattern

```java
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("User Controller Integration Tests")
class UserControllerIntegrationTest {

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @Autowired
  private UserRepository userRepository;

  @BeforeEach
  void setUp() {
    userRepository.deleteAll();
  }

  @Test
  @DisplayName("Should list users with pagination")
  void testListUsers() throws Exception {
    // Arrange
    User user1 = User.builder()
      .emailAddress("user1@example.com")
      .firstName("User")
      .lastName("One")
      .build();
    userRepository.save(user1);

    // Act & Assert
    mockMvc.perform(
        get("/api/v1/users")
          .param("page", "0")
          .param("size", "20")
          .contentType(MediaType.APPLICATION_JSON)
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value(true))
      .andExpect(jsonPath("$.data.content", hasSize(1)))
      .andExpect(jsonPath("$.data.content[0].emailAddress")
        .value("user1@example.com"));
  }

  @Test
  @DisplayName("Should create user and return 201")
  void testCreateUser() throws Exception {
    // Arrange
    CreateUserRequestDto dto = CreateUserRequestDto.builder()
      .emailAddress("newuser@example.com")
      .firstName("New")
      .lastName("User")
      .password("SecurePass123!")
      .accountType(AccountType.USER)
      .build();

    // Act & Assert
    mockMvc.perform(
        post("/api/v1/users")
          .contentType(MediaType.APPLICATION_JSON)
          .content(objectMapper.writeValueAsString(dto))
      )
      .andExpect(status().isCreated())
      .andExpect(jsonPath("$.status").value(true))
      .andExpect(jsonPath("$.data.emailAddress")
        .value("newuser@example.com"));
  }

  @Test
  @DisplayName("Should return 404 when user not found")
  void testGetUserNotFound() throws Exception {
    mockMvc.perform(get("/api/v1/users/999"))
      .andExpect(status().isNotFound())
      .andExpect(jsonPath("$.status").value(false));
  }
}
```

---

## Naming Conventions

### 1. Class Naming

```java
// Controllers
UserController              // ✅ Ends with "Controller"
CampaignController

// Services
UserService                 // ✅ Ends with "Service"
CampaignProcessingService

// Repositories
UserRepository              // ✅ Ends with "Repository"
CampaignRepository

// Entities
User                        // ✅ Singular noun, capitalized
Campaign
AuditLog

// DTOs
CreateUserRequestDto        // ✅ Descriptive with "Dto" suffix
UpdateUserRequestDto
UserResponseDto
ListUserQueryDto

// Mappers
UserMapper                  // ✅ Ends with "Mapper"
CampaignMapper

// Exceptions
EntityNotFoundException     // ✅ Ends with "Exception"
ConflictException
BadRequestException

// Interfaces
IUserRepository             // ✅ Starts with "I" (optional but recommended)
IUserService
```

### 2. Variable/Method Naming

```java
// Variables - camelCase
private Long userId;
private String emailAddress;
private LocalDateTime createdAt;
private List<User> activeUsers;

// Methods - verb + noun, camelCase
public UserResponseDto getUserById(Long id) { }
public Page<UserResponseDto> listUsers(Pageable pageable) { }
public void deleteUser(Long id) { }
public void softDeleteUser(Long id) { }
public boolean verifyPassword(String plain, String hashed) { }

// Getters/Setters
public Long getId() { }
public void setId(Long id) { }
public String getEmailAddress() { }
public void setEmailAddress(String emailAddress) { }

// Boolean getters
public boolean isActive() { }
public boolean hasPermission(String permission) { }
public boolean isDeleted() { }
```

### 3. Constant Naming

```java
// UPPER_SNAKE_CASE
public static final String APP_NAME = "Nexa Prime API";
public static final int DEFAULT_PAGE_SIZE = 20;
public static final long JWT_EXPIRATION_MS = 86400000L;  // 24 hours
public static final String EMAIL_REGEX = "^[A-Za-z0-9+_.-]+@(.+)$";

// Enum constants
public enum AccountStatus {
  ACTIVE,
  SUSPENDED,
  LOCKED,
  PERMANENT_LOCKED
}

public enum OrderType {
  ASC,
  DESC
}
```

### 4. Package Naming

```java
com.yourcompany.api            // REST controllers, API layer
com.yourcompany.config         // Configuration classes
com.yourcompany.constructs     // Constants, enums, interfaces
com.yourcompany.dto            // DTOs
com.yourcompany.entity         // JPA entities
com.yourcompany.exception      // Custom exceptions
com.yourcompany.repository     // Spring Data repositories
com.yourcompany.service        // Business logic services
com.yourcompany.security       // Security-related classes
com.yourcompany.util           // Utility classes
com.yourcompany.mapper         // MapStruct mappers
```

---

## Code Quality Checklist

### Before Committing Code:

- [ ] **Entities**
  - [ ] Extends `BaseEntity`
  - [ ] All FK columns indexed
  - [ ] All `WHERE`/`ORDER BY` columns indexed
  - [ ] Composite indexes for multi-column filters
  - [ ] Proper column types (NUMERIC for money, VARCHAR bounded, JSONB for semi-structured)
  - [ ] Soft delete support (nullable `deleted_at` column)

- [ ] **Repositories**
  - [ ] All methods use `@Query` with explicit field selection
  - [ ] No `findAll()` or `save()` without custom logic
  - [ ] All queries filter soft-deleted records
  - [ ] Named parameters used everywhere
  - [ ] Bulk operations use `@Modifying`

- [ ] **Services**
  - [ ] `@Service` and `@Transactional` annotations
  - [ ] `@RequiredArgsConstructor` for DI
  - [ ] All injected dependencies are `private final`
  - [ ] No business logic in controllers
  - [ ] Proper error handling with custom exceptions
  - [ ] Audit logging for significant actions
  - [ ] Using `@Slf4j` for logging (never `System.out`)

- [ ] **Controllers**
  - [ ] Correct HTTP method (`GET`, `POST`, `PATCH`, `DELETE`)
  - [ ] RESTful URLs (no verbs in paths)
  - [ ] All endpoints documented with `@Operation` and `@ApiResponse`
  - [ ] All controllers have `@Tag` for grouping
  - [ ] All methods delegate to service
  - [ ] Proper HTTP status codes
  - [ ] `@Valid` on all DTO parameters

- [ ] **DTOs**
  - [ ] All fields have `@Schema` documentation
  - [ ] Request DTOs have validation decorators (`@NotEmpty`, `@Email`, etc.)
  - [ ] Response DTOs exclude sensitive fields
  - [ ] Using specific field names (not anonymous objects)
  - [ ] MapStruct mappers for entity ↔ DTO conversion

- [ ] **Security**
  - [ ] Passwords hashed with `BCrypt` (strength 10)
  - [ ] JWT tokens validated on protected endpoints
  - [ ] Sensitive fields excluded from responses
  - [ ] Audit logging enabled for sensitive operations
  - [ ] SQL injection prevented (parameterized queries)

- [ ] **Database**
  - [ ] Migrations use Flyway with versioning
  - [ ] All tables have `created_at`, `updated_at`, `deleted_at`
  - [ ] Proper indexes on all query columns
  - [ ] No manual table creation (DDL managed via migrations)

- [ ] **Testing**
  - [ ] All endpoints have integration tests
  - [ ] Tests cover success case, error cases, validation failures
  - [ ] Unit tests for business logic
  - [ ] @ActiveProfiles("test") for test configuration
  - [ ] No mocking of repositories in integration tests

- [ ] **Code Quality**
  - [ ] No `System.out.println` or `System.err` (use `@Slf4j`)
  - [ ] No hardcoded strings (use constants/enums)
  - [ ] No magic numbers (extract to named constants)
  - [ ] Proper exception handling (specific exceptions, not generic)
  - [ ] Code follows Single Responsibility Principle
  - [ ] Methods have single purpose, reasonable size
  - [ ] No dead code or commented code
  - [ ] All warnings resolved (SonarQube clean)

### SonarQube Standards:

- Code Coverage: ≥ 80%
- Duplications: < 5%
- Issues: 0 blockers, < 5 majors
- Code Smells: < 10
- No security hotspots

---

## Project Setup Checklist

```bash
# 1. Create Spring Boot project
spring boot new nexa-prime-api --java-version=17

# 2. Add dependencies
# - Spring Boot Starter Web
# - Spring Boot Starter Data JPA
# - Spring Boot Starter Security
# - Spring Boot Starter Validation
# - PostgreSQL Driver
# - Flyway for migrations
# - MapStruct for DTOs
# - Lombok for boilerplate
# - SpringDoc OpenAPI (Swagger)
# - JUnit 5 + Mockito for testing

# 3. Configure database
# spring.datasource.url=jdbc:postgresql://localhost:5432/nexa_prime
# spring.datasource.username=postgres
# spring.datasource.password=...
# spring.jpa.hibernate.ddl-auto=validate
# spring.flyway.enabled=true

# 4. Create directory structure
src/main/java/com/yourcompany/
  ├── config/
  ├── constructs/
  ├── dto/
  ├── entity/
  ├── exception/
  ├── repository/
  ├── service/
  ├── security/
  ├── util/
  └── api/

# 5. Generate entities and migrations
# Use Flyway for ALL schema changes

# 6. Enable Swagger/OpenAPI
# springdoc.swagger-ui.path=/swagger-ui.html
# springdoc.api-docs.path=/api-docs
```

---

## Performance Optimization Guidelines

### 1. Query Optimization

- **Always use database indexes** on frequently queried columns
- **Eager load relationships only when needed** to avoid N+1 queries
- **Use projections** (DTOs) to select only required fields
- **Implement pagination** on all list endpoints
- **Use keyset pagination** for very large datasets
- **Cache frequently accessed, rarely-changing data** (Redis)

### 2. Batch Operations

```java
@Transactional
public void processBatch(List<Long> userIds) {
  // ✅ Bulk update
  userRepository.updateStatusBulk(userIds, AccountStatus.ACTIVE, 
    LocalDateTime.now());

  // ✅ Bulk insert
  List<AuditLog> logs = userIds.stream()
    .map(id -> AuditLog.builder()
      .userId(id)
      .action("BULK_UPDATE")
      .build())
    .collect(Collectors.toList());
  auditLogRepository.saveAll(logs);
}
```

### 3. Connection Pooling

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 20000
      idle-timeout: 300000
      max-lifetime: 1200000
```

---

## Summary

This document defines enterprise-grade standards for building REST APIs with Spring Boot. Key principles:

1. **Scale-First Design** - Assume billion-record tables
2. **Performance** - Explicit queries, indexed columns, pagination
3. **Security** - Password hashing, JWT, audit logging, sensitive data exclusion
4. **Code Quality** - Clean code, SOLID principles, comprehensive testing
5. **Maintainability** - Clear patterns, consistent naming, comprehensive documentation

**Remember:** Any deviation from these standards must be explicitly documented and approved. "Good enough" code is not acceptable. Excellence is the minimum standard.

---

**Version**: 1.0  
**Last Updated**: 2026-05-18  
**Author**: Enterprise Architecture Team
