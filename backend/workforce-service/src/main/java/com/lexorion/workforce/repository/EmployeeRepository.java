package com.lexorion.workforce.repository;
import com.lexorion.workforce.domain.*;import java.util.*;import org.springframework.data.domain.*;import org.springframework.data.jpa.repository.*;import org.springframework.data.repository.query.Param;
public interface EmployeeRepository extends JpaRepository<Employee,UUID>{
 @Query("select e from Employee e left join e.department d left join e.designation g left join e.reportingManager m "
  + "where e.workspace.id=:workspaceId and (:status is null or e.status=:status) "
  + "and (:departmentKey is null or d.key=:departmentKey) and (:designationKey is null or g.key=:designationKey) "
  + "and (:managerCode is null or m.code=:managerCode) "
  + "and (:search is null or lower(e.code) like :search or lower(e.firstName) like :search "
  + "or lower(e.lastName) like :search or lower(e.workEmail) like :search or lower(e.phone) like :search)")
 Page<Employee> search(@Param("workspaceId")UUID workspaceId,@Param("status")EmploymentStatus status,@Param("departmentKey")String departmentKey,@Param("designationKey")String designationKey,@Param("managerCode")String managerCode,@Param("search")String search,Pageable pageable);
 @Query("select e from Employee e left join fetch e.department left join fetch e.designation left join fetch e.reportingManager where e.workspace.id=:workspaceId order by e.code")List<Employee> findStructure(@Param("workspaceId")UUID workspaceId);
 List<Employee> findByWorkspaceIdAndReportingManagerPlatformUserIdOrderByCodeAsc(UUID workspaceId,UUID platformUserId);
 Optional<Employee> findByWorkspaceIdAndPlatformUserId(UUID workspaceId,UUID platformUserId);
 boolean existsByWorkspaceIdAndPlatformUserIdAndIdNot(UUID workspaceId,UUID platformUserId,UUID id);
 Optional<Employee> findByWorkspaceIdAndCodeAndPlatformUserId(UUID workspaceId,String code,UUID platformUserId);
 Optional<Employee> findByWorkspaceIdAndCodeAndReportingManagerPlatformUserId(UUID workspaceId,String code,UUID platformUserId);
 List<Employee> findByWorkspaceIdOrderByCodeAsc(UUID workspaceId);Optional<Employee> findByWorkspaceIdAndCode(UUID workspaceId,String code);boolean existsByWorkspaceIdAndCode(UUID workspaceId,String code);boolean existsByWorkspaceIdAndReportingManagerId(UUID workspaceId,UUID reportingManagerId);long countByWorkspaceIdAndStatus(UUID workspaceId,EmploymentStatus status);
}
