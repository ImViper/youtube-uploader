// Custom Cypress commands

Cypress.Commands.add('login', (username = 'testuser', password = 'password123') => {
  cy.visit('/login');
  cy.findByLabelText(/username/i).type(username);
  cy.findByLabelText(/password/i).type(password);
  cy.findByRole('button', { name: /login/i }).click();

  // Wait for redirect to dashboard
  cy.url().should('include', '/dashboard');
  cy.findByText(/dashboard/i).should('be.visible');
});

Cypress.Commands.add('logout', () => {
  cy.findByRole('button', { name: /user menu/i }).click();
  cy.findByRole('menuitem', { name: /logout/i }).click();
  cy.url().should('include', '/login');
});

Cypress.Commands.add('createAccount', ({ username, email, password }) => {
  cy.visit('/accounts');
  cy.findByRole('button', { name: /add account/i }).click();

  // Fill form
  cy.findByLabelText(/username/i).type(username);
  cy.findByLabelText(/email/i).type(email);
  cy.findByLabelText(/password/i).type(password);

  // Submit
  cy.findByRole('button', { name: /create/i }).click();

  // Wait for success
  cy.waitForToast('Account created successfully');
});

Cypress.Commands.add('uploadVideo', ({ title, description, file }) => {
  cy.visit('/uploads');
  cy.findByRole('button', { name: /new upload/i }).click();

  // Fill form
  cy.findByLabelText(/title/i).type(title);
  cy.findByLabelText(/description/i).type(description);

  // Upload file
  cy.fixture(file).then((fileContent) => {
    cy.findByLabelText(/video file/i).attachFile({
      fileContent: fileContent.toString(),
      fileName: file,
      mimeType: 'video/mp4',
    });
  });

  // Submit
  cy.findByRole('button', { name: /start upload/i }).click();
});

Cypress.Commands.add('waitForToast', (message) => {
  cy.contains('.ant-message', message, { timeout: 10000 }).should('be.visible');
});

Cypress.Commands.add('mockApiResponse', (method, url, response, status = 200) => {
  cy.intercept(method, url, {
    statusCode: status,
    body: response,
  }).as(`${method}_${url.split('/').pop()}`);
});

// Add file upload support
import 'cypress-file-upload';
