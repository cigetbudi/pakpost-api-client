namespace Pakpost.Application.Common.Interfaces;

public interface IPlatformCreatorInvitationEmailSender
{
    Task SendAsync(string email, string invitationUrl, CancellationToken ct);
}
