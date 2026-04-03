using MailKit.Net.Smtp;
using MimeKit;

namespace GITP.API.Services;

public class EmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendEmailSafeAsync(string toEmail, string toName, string subject, string htmlBody)
    {
        try
        {
            if (!_configuration.GetValue<bool>("Smtp:Enabled", false))
            {
                _logger.LogInformation("SMTP disabled. Would send to {Email}: {Subject}", toEmail, subject);
                return;
            }

            var message = new MimeMessage();
            var fromEmail = _configuration["Smtp:FromEmail"] ?? "noreply@gitp.local";
            var fromName = _configuration["Smtp:FromName"] ?? "GITP 系統通知";
            message.From.Add(new MailboxAddress(fromName, fromEmail));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = subject;
            message.Body = new TextPart(MimeKit.Text.TextFormat.Html) { Text = htmlBody };

            using var client = new SmtpClient();
            var host = _configuration["Smtp:Host"] ?? "localhost";
            var port = _configuration.GetValue<int>("Smtp:Port", 587);
            var useSsl = _configuration.GetValue<bool>("Smtp:UseSsl", false);

            await client.ConnectAsync(host, port, useSsl);

            var username = _configuration["Smtp:Username"];
            var password = _configuration["Smtp:Password"];
            if (!string.IsNullOrEmpty(username))
                await client.AuthenticateAsync(username, password);

            await client.SendAsync(message);
            await client.DisconnectAsync(true);

            _logger.LogInformation("Email sent to {Email}: {Subject}", toEmail, subject);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send email to {Email}: {Subject}", toEmail, subject);
        }
    }
}
