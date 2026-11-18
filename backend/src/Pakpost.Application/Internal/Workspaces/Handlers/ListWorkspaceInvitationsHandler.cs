using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.DTOs;
using Pakpost.Application.Internal.Workspaces.Queries;
using Pakpost.Application.Internal.Workspaces.Services;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class ListWorkspaceInvitationsHandler(IWorkspaceRepository workspaces, IWorkspaceInvitationRepository invitations)
    : IRequestHandler<ListWorkspaceInvitationsQuery, IReadOnlyList<InvitationDto>>
{
    public async ValueTask<IReadOnlyList<InvitationDto>> Handle(ListWorkspaceInvitationsQuery q, CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(workspaces, q.WorkspaceId, q.ActorId, WorkspacePermissions.MemberManage, ct);
        return (await invitations.ListAsync(q.WorkspaceId, ct)).Select(InvitationTokens.ToDto).ToArray();
    }
}
