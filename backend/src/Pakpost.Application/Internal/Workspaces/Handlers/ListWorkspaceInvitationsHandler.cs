using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using Mediator;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

namespace Pakpost.Application.Internal.Workspaces;

public sealed class ListWorkspaceInvitationsHandler(IWorkspaceRepository workspaces, IWorkspaceInvitationRepository invitations)
    : IRequestHandler<ListWorkspaceInvitationsQuery, IReadOnlyList<InvitationDto>>
{
    public async ValueTask<IReadOnlyList<InvitationDto>> Handle(ListWorkspaceInvitationsQuery q, CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(workspaces, q.WorkspaceId, q.ActorId, WorkspacePermissions.MemberManage, ct);
        return (await invitations.ListAsync(q.WorkspaceId, ct)).Select(InvitationTokens.ToDto).ToArray();
    }
}
