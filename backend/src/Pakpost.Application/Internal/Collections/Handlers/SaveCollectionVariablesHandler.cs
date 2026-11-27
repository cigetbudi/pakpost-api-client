using System.Text.Json;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

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
        CollectionScriptSettings.Apply(item, cmd.PreScript, cmd.PostScript);
        item.SetVariables(JsonSerializer.Serialize(after));
        await uow.SaveChangesAsync(ct);
        return CollectionScriptSettings.WithScripts(item, CollectionVariableMapper.ToDto(item.VariablesVersion, after, cipher,
            WorkspacePermissions.Can(member, WorkspacePermissions.EnvironmentSecretRead)));
    }
}
