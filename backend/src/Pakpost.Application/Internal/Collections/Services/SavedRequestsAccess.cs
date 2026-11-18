using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public abstract class SavedRequestsAccess
{
    protected static async Task Check(
        Guid actorId,
        Guid workspaceId,
        Guid collectionId,
        IWorkspaceRepository workspaces,
        ICollectionRepository collections,
        CancellationToken ct,
        bool destructive = false)
    {
        await WorkspacePermissions.RequireAsync(workspaces, workspaceId, actorId,
            destructive?WorkspacePermissions.CollectionWrite:WorkspacePermissions.CollectionRead, ct);
        var c = await collections.FindAsync(collectionId, ct);
        if (c is null || c.WorkspaceId != workspaceId)
            throw AppException.NotFound("Collection not found");
    }
    // Legacy JSONB may contain literal credentials. Never return those values to the browser.
    protected static SavedRequestDto ToDto(SavedRequest x) => new(x.Id, x.CollectionId, x.Name, x.Method, x.Url,
        SavedHeaderPolicy.RedactLegacyCredentials(x.HeadersJson), x.Body, x.BodyMode, x.ContentType, x.FormFieldsJson, x.PreRequestScript, x.PostResponseScript, x.Revision, x.FolderId);
}
