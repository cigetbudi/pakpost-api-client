using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class RestoreSavedRequestHistoryHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ISavedRequestRepository requests,
    ISavedRequestRevisionRepository history,
    IEnvironmentValueCipher cipher,
    IUnitOfWork unitOfWork)
    : IRequestHandler<RestoreSavedRequestHistoryCommand, SavedRequestDto>
{
    public async ValueTask<SavedRequestDto> Handle(
        RestoreSavedRequestHistoryCommand command,
        CancellationToken ct)
    {
        var item = await SavedRequestHistoryAccess.Check(
            command.ActorId,
            command.WorkspaceId,
            command.CollectionId,
            command.RequestId,
            true,
            workspaces,
            collections,
            requests,
            ct);

        if (command.ExpectedRevision <= 0)
        {
            throw new AppException(428, "Current revision is required");
        }

        if (item.Revision != command.ExpectedRevision)
        {
            throw AppException.Conflict("Cloud request changed. Reload before restoring.");
        }

        var target = await history.FindAsync(item.Id, command.Revision, ct)
            ?? throw AppException.NotFound("Revision not found");

        var old = SavedRequestHistoryCodec.Open(target, cipher);
        SavedHeaderPolicy.EnsureSafe(old.HeadersJson);

        await SavedRequestHistoryCodec.CaptureUpdateAsync(item, history, cipher, ct);

        item.Update(
            old.Name,
            old.Method,
            old.Url,
            old.HeadersJson,
            old.Body,
            old.BodyMode,
            old.ContentType,
            old.FormFieldsJson,
            old.PreRequestScript,
            old.PostResponseScript);

        history.Add(SavedRequestHistoryCodec.Capture(item, command.ActorId, "restored", cipher));

        await unitOfWork.SaveChangesAsync(ct);

        return new SavedRequestDto(
            item.Id,
            item.CollectionId,
            item.Name,
            item.Method,
            item.Url,
            SavedHeaderPolicy.RedactLegacyCredentials(item.HeadersJson),
            item.Body,
            item.BodyMode,
            item.ContentType,
            item.FormFieldsJson,
            item.PreRequestScript,
            item.PostResponseScript,
            item.Revision);
    }
}
