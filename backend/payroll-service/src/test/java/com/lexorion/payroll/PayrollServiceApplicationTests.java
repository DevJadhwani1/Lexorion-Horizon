package com.lexorion.payroll;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.lexorion.payroll.tenant.PayrollAuthorityClient;
import com.lexorion.payroll.workforce.WorkforceEmployeeClient;

@SpringBootTest
class PayrollServiceApplicationTests {
	@MockitoBean PayrollAuthorityClient authority;
	@MockitoBean WorkforceEmployeeClient workforce;

	@Test
	void contextLoads() {
	}

}
