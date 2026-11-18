using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Environments.Commands;
using Pakpost.Application.Internal.Environments.DTOs;
using Pakpost.Application.Internal.Environments.Services;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Environments.Handlers;

public sealed class CreateEnvironmentHandler(IWorkspaceRepository workspaces, IRequestEnvironmentRepository environments, IUnitOfWork uow)
    : IRequestHandler<CreateEnvironmentCommand, RequestEnvironmentDto>
{
    public async ValueTask<RequestEnvironmentDto> Handle(CreateEnvironmentCommand c, CancellationToken ct)
    {
        await EnvironmentAccess.Verify(workspaces, c.WorkspaceId, c.ActorId, true, ct);
        var environment = new RequestEnvironment(c.WorkspaceId, c.Name);
        environments.Add(environment);
        await uow.SaveChangesAsync(ct);
        return new(environment.Id, environment.Name, []);
    }
}
