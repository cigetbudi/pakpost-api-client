using System.Text;
using System.Text.Json;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Queries;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class PageSavedRequestIndexHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ISavedRequestRepository requests)
    : IRequestHandler<PageSavedRequestIndexQuery, SavedRequestIndexPageDto>
{
    public async ValueTask<SavedRequestIndexPageDto> Handle(PageSavedRequestIndexQuery query, CancellationToken ct)
    {
        if (query.Size is < 1 or > 200)
        {
            throw AppException.BadRequest("Page size must be between 1 and 200");
        }
        if ((query.Search?.Length ?? 0) > 120)
        {
            throw AppException.BadRequest("Search must be at most 120 characters");
        }
        if (query.FolderId.HasValue && query.RootOnly)
        {
            throw AppException.BadRequest("Select either a folder or the collection root");
        }
        Guid? after = null;
        string? afterName = null;
        if (!string.IsNullOrWhiteSpace(query.After))
        {
            if (!query.SortByName)
            {
                if (!Guid.TryParseExact(query.After, "N", out var id))
                    throw AppException.BadRequest("Invalid request page cursor");
                after = id;
            }
            else
            {
                try
                {
                    if (query.After.Length > 400) throw new FormatException();
                    var normalized = query.After.Replace('-', '+').Replace('_', '/');
                    var json = Encoding.UTF8.GetString(Convert.FromBase64String(
                        normalized.PadRight((normalized.Length + 3) / 4 * 4, '=')));
                    var pair = JsonSerializer.Deserialize<string[]>(json);
                    if (pair is null || pair.Length != 2 || pair[0] is null || pair[0].Length > 120 ||
                        !Guid.TryParseExact(pair[1], "N", out var id))
                        throw new FormatException();
                    afterName = pair[0];
                    after = id;
                }
                catch (Exception ex) when (ex is FormatException or JsonException or DecoderFallbackException)
                {
                    throw AppException.BadRequest("Invalid request page cursor");
                }
            }
        }

        await SavedRequestsAccess.Check(query.ActorId, query.WorkspaceId, query.CollectionId,
            workspaces, collections, ct);
        var page = await requests.PageIndexAsync(query.CollectionId, query.Size, after,
            afterName, query.Search?.Trim(), query.FolderId, query.RootOnly,
            query.SortByName, ct);

        return new SavedRequestIndexPageDto(page.Items.Select(item => new SavedRequestIndexDto(
            item.Id, item.CollectionId, item.Name, item.Method, item.Url,
            SavedHeaderPolicy.RedactLegacyCredentials(item.HeadersJson), item.Revision,
            item.FolderId)).ToArray(), page.NextCursor, page.HasMore);
    }
}
