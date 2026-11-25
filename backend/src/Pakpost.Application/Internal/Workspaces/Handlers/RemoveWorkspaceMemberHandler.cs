using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Workspaces.Commands;
using Pakpost.Application.Internal.Workspaces.Services;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class RemoveWorkspaceMemberHandler(IWorkspaceRepository workspaces, ITransactionManager transactions)
    : IRequestHandler<RemoveWorkspaceMemberCommand>
{
    public async ValueTask<Unit> Handle(RemoveWorkspaceMemberCommand command, CancellationToken ct)
    {
        await using var transaction = await transactions.BeginSerializableAsync(ct);
        var actor = await WorkspacePermissions.RequireAsync(workspaces, command.WorkspaceId,
            command.ActorId, WorkspacePermissions.MemberManage, ct);
        if (command.ActorId == command.UserId)
            throw AppException.Forbidden("You cannot remove yourself");
        var workspace = await workspaces.FindAsync(command.WorkspaceId, ct)
            ?? throw AppException.NotFound("Workspace not found");
        if (workspace.OwnerUserId == command.UserId)
            throw AppException.Forbidden("Cannot remove the workspace founder");
        var target = await workspaces.FindMemberAsync(command.WorkspaceId, command.UserId, ct)
            ?? throw AppException.NotFound("Workspace member not found");
        RoleDelegation.CheckCanModify(actor, target);
        if (await workspaces.DeleteMemberAsync(command.WorkspaceId, command.UserId, ct) != 1)
            throw AppException.Conflict("Membership changed. Refresh and try again.");
        await transaction.CommitAsync(ct);
        return Unit.Value;
    }
}
