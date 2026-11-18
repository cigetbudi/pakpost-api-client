using Pakpost.Domain.Entities;

namespace Pakpost.Application.Common.Interfaces;

public interface IWorkspaceInvitationEmailSender
{
    Task SendAsync(string email, string workspaceName, string invitationUrl, CancellationToken ct);
}
