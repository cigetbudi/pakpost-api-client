using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Environments.Commands;
using Pakpost.Application.Internal.Environments.Services;

namespace Pakpost.Application.Internal.Environments.Handlers;

public sealed class DeleteEnvironmentHandler(IWorkspaceRepository workspaces, IRequestEnvironmentRepository environments, IUnitOfWork uow)
    : IRequestHandler<DeleteEnvironmentCommand>
{
    public async ValueTask<Unit> Handle(DeleteEnvironmentCommand c, CancellationToken ct)
    {
        await EnvironmentAccess.Verify(workspaces, c.WorkspaceId, c.ActorId, true, ct);
        var env = await environments.FindAsync(c.EnvironmentId, ct);
        if (env is null || env.WorkspaceId != c.WorkspaceId)
            throw AppException.NotFound();
        environments.Remove(env);
        await uow.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
