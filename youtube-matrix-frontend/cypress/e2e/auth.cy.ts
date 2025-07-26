describe('Authentication E2E Tests', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('redirects to login when not authenticated', () => {
    cy.url().should('include', '/login');
    cy.findByText(/sign in to youtube matrix/i).should('be.visible');
  });

  it('logs in with valid credentials', () => {
    cy.fixture('users').then((users) => {
      const { username, password } = users.user;

      // Mock successful login
      cy.mockApiResponse('POST', '/api/auth/login', {
        user: users.user,
        token: 'test-jwt-token',
      });

      cy.findByLabelText(/username/i).type(username);
      cy.findByLabelText(/password/i).type(password);
      cy.findByRole('button', { name: /login/i }).click();

      // Should redirect to dashboard
      cy.url().should('include', '/dashboard');
      cy.findByText(/welcome back/i).should('be.visible');

      // User info should be in header
      cy.findByText(username).should('be.visible');
    });
  });

  it('shows error with invalid credentials', () => {
    // Mock failed login
    cy.mockApiResponse(
      'POST',
      '/api/auth/login',
      {
        error: 'Invalid username or password',
      },
      401,
    );

    cy.findByLabelText(/username/i).type('wronguser');
    cy.findByLabelText(/password/i).type('wrongpass');
    cy.findByRole('button', { name: /login/i }).click();

    // Should show error message
    cy.findByText(/invalid username or password/i).should('be.visible');

    // Should remain on login page
    cy.url().should('include', '/login');
  });

  it('validates required fields', () => {
    // Try to submit empty form
    cy.findByRole('button', { name: /login/i }).click();

    // Should show validation errors
    cy.findByText(/username is required/i).should('be.visible');
    cy.findByText(/password is required/i).should('be.visible');
  });

  it('remembers user with remember me option', () => {
    cy.fixture('users').then((users) => {
      cy.mockApiResponse('POST', '/api/auth/login', {
        user: users.user,
        token: 'test-jwt-token',
      });

      // Check remember me
      cy.findByLabelText(/remember me/i).check();

      // Login
      cy.findByLabelText(/username/i).type(users.user.username);
      cy.findByLabelText(/password/i).type(users.user.password);
      cy.findByRole('button', { name: /login/i }).click();

      // Wait for redirect
      cy.url().should('include', '/dashboard');

      // Check localStorage has token
      cy.window().then((win) => {
        expect(win.localStorage.getItem('authToken')).to.exist();
      });
    });
  });

  it('logs out successfully', () => {
    // Login first
    cy.login();

    // Mock logout
    cy.mockApiResponse('POST', '/api/auth/logout', { success: true });

    // Open user menu
    cy.findByRole('button', { name: /user menu/i }).click();

    // Click logout
    cy.findByRole('menuitem', { name: /logout/i }).click();

    // Should redirect to login
    cy.url().should('include', '/login');

    // Token should be removed
    cy.window().then((win) => {
      expect(win.localStorage.getItem('authToken')).to.not.exist();
    });
  });

  it('handles session expiration', () => {
    // Login first
    cy.login();

    // Mock expired session response
    cy.mockApiResponse(
      'GET',
      '/api/accounts',
      {
        error: 'Session expired',
      },
      401,
    );

    // Navigate to protected route
    cy.visit('/accounts');

    // Should redirect to login with message
    cy.url().should('include', '/login');
    cy.findByText(/session expired/i).should('be.visible');
  });

  it('supports password reset flow', () => {
    // Click forgot password
    cy.findByRole('link', { name: /forgot password/i }).click();

    // Should navigate to reset page
    cy.url().should('include', '/forgot-password');

    // Mock reset request
    cy.mockApiResponse('POST', '/api/auth/forgot-password', {
      message: 'Reset link sent to your email',
    });

    // Enter email
    cy.findByLabelText(/email/i).type('test@example.com');
    cy.findByRole('button', { name: /send reset link/i }).click();

    // Should show success message
    cy.findByText(/reset link sent to your email/i).should('be.visible');
  });

  it('validates password strength on registration', () => {
    // Navigate to registration
    cy.findByRole('link', { name: /sign up/i }).click();
    cy.url().should('include', '/register');

    // Enter weak password
    cy.findByLabelText(/^password$/i).type('weak');

    // Should show weak indicator
    cy.findByText(/weak/i).should('be.visible');
    cy.get('.strength-indicator').should('have.class', 'weak');

    // Enter strong password
    cy.findByLabelText(/^password$/i)
      .clear()
      .type('Str0ng!Pass#2023');

    // Should show strong indicator
    cy.findByText(/strong/i).should('be.visible');
    cy.get('.strength-indicator').should('have.class', 'strong');
  });

  it('handles concurrent login attempts', () => {
    cy.fixture('users').then((users) => {
      const { username, password } = users.user;

      // Mock rate limit response
      cy.mockApiResponse(
        'POST',
        '/api/auth/login',
        {
          error: 'Too many login attempts. Please try again later.',
        },
        429,
      );

      // Make multiple rapid login attempts
      for (let i = 0; i < 3; i++) {
        cy.findByLabelText(/username/i)
          .clear()
          .type(username);
        cy.findByLabelText(/password/i)
          .clear()
          .type(password);
        cy.findByRole('button', { name: /login/i }).click();
        cy.wait(100);
      }

      // Should show rate limit error
      cy.findByText(/too many login attempts/i).should('be.visible');
    });
  });
});
