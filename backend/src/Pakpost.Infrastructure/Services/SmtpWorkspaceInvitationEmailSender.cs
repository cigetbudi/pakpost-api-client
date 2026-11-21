using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
namespace Pakpost.Infrastructure.Services;

public sealed class SmtpWorkspaceInvitationEmailSender(IConfiguration configuration):IWorkspaceInvitationEmailSender
{
    public async Task SendAsync(string email,string workspaceName,string invitationUrl,CancellationToken ct)
    {
        var host=configuration["Invitations:Smtp:Host"];
        var from=configuration["Invitations:Smtp:From"];
        var user=configuration["Invitations:Smtp:Username"];
        var password=configuration["Invitations:Smtp:Password"];
        // Never return an invitation token to the caller as a fallback when SMTP isn't configured.
        if(string.IsNullOrWhiteSpace(host)||string.IsNullOrWhiteSpace(from)||
           string.IsNullOrWhiteSpace(user)||string.IsNullOrWhiteSpace(password))
            throw AppException.BadRequest("Email invitations are not configured on this PakPost server");
        var port=configuration.GetValue("Invitations:Smtp:Port",587);
        if(port is <1 or >65535)throw AppException.BadRequest("Invalid SMTP port");
        using var message=WorkspaceInvitationEmailMessage.Create(from,email,workspaceName,invitationUrl);
        using var client=new SmtpClient(host,port)
        {
            EnableSsl=true, // Requires STARTTLS, typically port 587.
            UseDefaultCredentials=false,
            Credentials=new NetworkCredential(user,password),
            DeliveryMethod=SmtpDeliveryMethod.Network,
            Timeout=15000
        };
        try{await client.SendMailAsync(message,ct);}
        catch(SmtpException){throw AppException.BadRequest("Invitation email could not be delivered. Check server SMTP configuration");}
    }
}
