using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;

namespace Pakpost.Infrastructure.Services;

/// <summary>Shares SMTP configuration with existing workspace invitation emails.</summary>
public sealed class SmtpPlatformCreatorInvitationEmailSender(IConfiguration configuration)
    : IPlatformCreatorInvitationEmailSender
{
    public async Task SendAsync(string email, string invitationUrl, CancellationToken ct)
    {
        var host = configuration["Invitations:Smtp:Host"];
        var from = configuration["Invitations:Smtp:From"];
        var username = configuration["Invitations:Smtp:Username"];
        var password = configuration["Invitations:Smtp:Password"];
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from) ||
            string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            throw AppException.BadRequest("Email invitations are not configured on this PakPost server");
        var port = configuration.GetValue("Invitations:Smtp:Port", 587);
        if (port is < 1 or > 65535) throw AppException.BadRequest("Invalid SMTP port");

        using var message = PlatformCreatorInvitationEmailMessage.Create(from, email, invitationUrl);
        using var client = new SmtpClient(host, port)
        {
            EnableSsl = true,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(username, password),
            DeliveryMethod = SmtpDeliveryMethod.Network,
            Timeout = 15000
        };
        try { await client.SendMailAsync(message, ct); }
        catch (SmtpException) { throw AppException.BadRequest("Invitation email could not be delivered. Check server SMTP configuration"); }
    }
}
