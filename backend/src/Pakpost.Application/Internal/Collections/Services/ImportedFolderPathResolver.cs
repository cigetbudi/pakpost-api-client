using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Services;

// Resolves folder paths during a single atomic Cloud import. Reuses folder IDs
// for duplicate paths without concatenating them into request names.
internal sealed class ImportedFolderPathResolver(Guid collectionId, ICollectionFolderRepository folders)
{
    private readonly Dictionary<string, CollectionFolder> pathFolders = new(StringComparer.OrdinalIgnoreCase);

    public Guid? Resolve(List<string>? path)
    {
        Guid? folderId = null;
        if (path is not { Count: > 0 }) return folderId;
        if (path.Count > 24)
            throw AppException.BadRequest("Imported folder depth exceeds 24");

        var currentPath = "";
        foreach (var segment in path)
        {
            if (string.IsNullOrWhiteSpace(segment) || segment.Trim().Length > 120)
                throw AppException.BadRequest("Invalid imported folder segment");

            var name = segment.Trim();
            currentPath += name.Length + ":" + name + "/";
            if (!pathFolders.TryGetValue(currentPath, out var folder))
            {
                if (pathFolders.Count >= 500)
                    throw AppException.BadRequest("Folder limit: 500 per collection");

                folder = new CollectionFolder(collectionId, folderId, name);
                pathFolders[currentPath] = folder;
                folders.Add(folder);
            }
            folderId = folder.Id;
        }
        return folderId;
    }
}
