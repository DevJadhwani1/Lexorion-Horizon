package com.lexorion.payroll.repository;
import com.lexorion.payroll.domain.CalculationLine;import java.util.UUID;import org.springframework.data.jpa.repository.JpaRepository;
public interface CalculationLineRepository extends JpaRepository<CalculationLine,UUID>{}
