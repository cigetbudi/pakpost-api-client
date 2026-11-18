using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;

namespace Pakpost.Application.Internal.Collections;

public sealed class SaveCollectionVariablesHandler(ICollectionRepository collections,
    IWorkspaceRepository workspaces, IEnvironmentValueCipher cipher, IUnitOfWork uow)
    : IRequestHandler<SaveCollectionVariablesCommand, CollectionVariablesDto>
{
    public async ValueTask<CollectionVariablesDto> Handle(SaveCollectionVariablesCommand cmd, CancellationToken ct)
    {
        var member = await WorkspacePermissions.RequireAsync(workspaces, cmd.WorkspaceId, cmd.ActorId,
            WorkspacePermissions.CollectionWrite, ct);
        var item = await collections.FindAsync(cmd.CollectionId, ct);
        if (item is null || item.WorkspaceId != cmd.WorkspaceId)
            throw AppException.NotFound("Collection not found");
        if (item.VariablesVersion != cmd.Version)
            throw AppException.Conflict("Collection variables changed in another session. Reload before saving.");
        var before = CollectionVariableMapper.Read(item.VariablesJson);
        var after = CollectionVariableMapper.ToStored(cmd.Variables, before, cipher);
        item.SetVariables(JsonSerializer.Serialize(after));
        await uow.SaveChangesAsync(ct);
        return CollectionVariableMapper.ToDto(item.VariablesVersion, after, cipher,
            WorkspacePermissions.Can(member, WorkspacePermissions.EnvironmentSecretRead));
    }
}
