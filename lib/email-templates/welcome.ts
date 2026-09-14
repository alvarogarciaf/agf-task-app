export interface WelcomeEmailOptions {
  email: string
  displayName?: string
  passwordResetUrl: string
  appName?: string
  appUrl?: string
}

export function renderWelcomeEmailHtml(options: WelcomeEmailOptions): string {
  const {
    email,
    displayName,
    passwordResetUrl,
    appName = "Tasker AGF",
    appUrl = "https://tasks.garciaamar.com",
  } = options

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Welcome to ${appName}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    /* Reset & Client-Specific Styles */
    body {
      margin: 0;
      padding: 0;
      min-width: 100%;
      background-color: #f4f4f5;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    /* Mobile Responsive Styles */
    @media only screen and (max-width: 600px) {
      .outer-container {
        padding: 16px 12px !important;
      }
      .card {
        padding: 32px 20px !important;
        border-radius: 12px !important;
      }
      .heading {
        font-size: 22px !important;
        line-height: 28px !important;
      }
      .body-text {
        font-size: 15px !important;
        line-height: 22px !important;
      }
      .cta-button {
        display: block !important;
        width: 100% !important;
        padding: 14px 20px !important;
        text-align: center !important;
        box-sizing: border-box !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
  <!-- Outer background wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f5; margin: 0; padding: 0;">
    <tr>
      <td align="center" class="outer-container" style="padding: 40px 16px;">
        <!-- Email Container (max 560px) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; margin: 0 auto;">
          
          <!-- Brand Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <a href="${appUrl}" target="_blank" style="text-decoration: none; display: inline-flex; align-items: center;">
                      <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #09090b; text-transform: uppercase;">${appName}</span>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td class="card" style="background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; padding: 40px 36px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);">
              
              <!-- Icon Circle -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background-color: #eff6ff; border: 1px solid #bfdbfe; text-align: center; line-height: 56px;">
                      <!-- User / Key SVG -->
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Headline -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 14px;">
                    <h1 class="heading" style="margin: 0; font-size: 24px; font-weight: 700; color: #09090b; letter-spacing: -0.5px; line-height: 32px;">
                      Welcome to ${appName}
                    </h1>
                  </td>
                </tr>
              </table>

              <!-- Body Paragraph -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="padding-bottom: 24px;">
                    <p class="body-text" style="margin: 0 0 12px 0; font-size: 15px; line-height: 24px; color: #52525b;">
                      Hi ${displayName || 'there'},
                    </p>
                    <p class="body-text" style="margin: 0 0 12px 0; font-size: 15px; line-height: 24px; color: #52525b;">
                      An account has been created for you with the email <strong>${email}</strong>.
                    </p>
                    <p class="body-text" style="margin: 0; font-size: 15px; line-height: 24px; color: #52525b;">
                      To get started, please set a secure password for your account by clicking the button below:
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="border-radius: 8px; background-color: #09090b;">
                          <a href="${passwordResetUrl}" class="cta-button" target="_blank" style="display: inline-block; background-color: #09090b; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; letter-spacing: -0.2px;">
                            Set Your Password
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Fallback Link Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; font-weight: 500;">
                      Button not working? Copy and paste this link into your browser:
                    </p>
                    <p style="margin: 0; font-size: 12px; line-height: 18px; word-break: break-all;">
                      <a href="${passwordResetUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">
                        ${passwordResetUrl}
                      </a>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-top: 24px;">
                    <p style="margin: 0; font-size: 13px; line-height: 20px; color: #71717a; border-top: 1px solid #f4f4f5; padding-top: 16px;">
                      This link will expire in 24 hours. After setting your password, you can sign in to your workspace at <a href="${appUrl}" style="color: #2563eb; text-decoration: underline;">${appUrl}</a>.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer (No Signature) -->
          <tr>
            <td align="center" style="padding-top: 24px; padding-bottom: 12px;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #a1a1aa;">
                ${appName} • Offline-first productivity
              </p>
              <p style="margin: 0; font-size: 12px; color: #d4d4d8;">
                &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
