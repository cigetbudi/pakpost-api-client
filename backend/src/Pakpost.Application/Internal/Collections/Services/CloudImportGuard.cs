using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Validators;

namespace Pakpost.Application.Internal.Collections.Services;

// Validation boundary; the handler persists imported folders, requests and revisions atomically.
internal static class CloudImportGuard
{
    public static void ValidateBatch(ImportCollectionsCommand command)
    {
        if (command.Collections is not { Count: > 0 and <= 30 } ||
            command.Collections.Any(item => item is null || item.Requests is null || item.Variables is null) ||
            command.Collections.Sum(item => item.Requests.Count) > 200)
        {
            throw AppException.BadRequest("Cloud import limits exceeded (30 collections, 200 requests)");
        }
    }

    public static void ValidateCollection(
        ImportCollectionsCommand command, CloudImportCollection incomingCollection,
        SaveCollectionVariablesValidator variablesValidator)
    {
        if (string.IsNullOrWhiteSpace(incomingCollection.Name) ||
            incomingCollection.Name.Trim().Length > 120)
        {
            throw AppException.BadRequest("Collection name must be 1–120 characters");
        }

        var variableCheck = variablesValidator.Validate(new SaveCollectionVariablesCommand(
            command.ActorId,
            command.WorkspaceId,
            Guid.Empty,
            0,
            incomingCollection.Variables, incomingCollection.PreScript, incomingCollection.PostScript));

        if (!variableCheck.IsValid)
        {
            throw AppException.BadRequest(
                "Invalid collection variables: " + variableCheck.Errors[0].ErrorMessage);
        }
    }

    public static void ValidateRequest(
        ImportCollectionsCommand command, Guid collectionId, CloudImportRequest incoming,
        SaveRequestValidator requestValidator)
    {
        if (incoming is null)
        {
            throw AppException.BadRequest("Request cannot be null");
        }

        var validation = requestValidator.Validate(new SaveRequestCommand(
            command.ActorId,
            command.WorkspaceId,
            collectionId,
            incoming.Name,
            incoming.Method,
            incoming.Url,
            incoming.HeadersJson,
            incoming.Body,
            incoming.BodyMode,
            incoming.ContentType,
            incoming.FormFieldsJson,
            incoming.PreRequestScript,
            incoming.PostResponseScript));

        if (!validation.IsValid)
        {
            throw AppException.BadRequest(
                "Invalid imported request: " + validation.Errors[0].ErrorMessage);
        }

        SavedHeaderPolicy.EnsureSafe(incoming.HeadersJson);
    }
}
