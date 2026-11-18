using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Workspaces.Commands;

namespace Pakpost.Application.Internal.Workspaces.Handlers;

public sealed class DeleteWorkspaceHandler(
    IWorkspaceRepository workspaces,
    ITransactionManager transactions)
    : IRequestHandler<DeleteWorkspaceCommand>
{
    public async ValueTask<Unit> Handle(DeleteWorkspaceCommand command, CancellationToken ct)
    {
        await using var transaction = await transactions.BeginSerializableAsync(ct);

        var workspace = await workspaces.FindAsync(command.WorkspaceId, ct)
            ?? throw AppException.NotFound("Workspace not found");

        if (workspace.OwnerUserId != command.ActorId)
        {
            throw AppException.Forbidden("Only the workspace founder can delete this workspace");
        }

        var deleted = await workspaces.DeleteOwnedAsync(
            command.WorkspaceId,
            command.ActorId,
            ct);

        if (deleted != 1)
        {
            throw AppException.Conflict("Workspace changed. Refresh and try again.");
        }

        await transaction.CommitAsync(ct);
        return Unit.Value;
    }
}
