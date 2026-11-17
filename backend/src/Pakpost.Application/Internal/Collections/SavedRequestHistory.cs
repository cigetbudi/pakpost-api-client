using System.Text.Json;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed record SavedRequestHistoryItemDto(int Revision,string Action,Guid ActorId,DateTimeOffset CreatedAt);
public sealed record SavedRequestHistoryDetailDto(int Revision,string Action,Guid ActorId,DateTimeOffset CreatedAt,SavedRequestDto Request);
public sealed record ListSavedRequestHistoryQuery(Guid ActorId,Guid WorkspaceId,Guid CollectionId,Guid RequestId):IRequest<IReadOnlyList<SavedRequestHistoryItemDto>>;
public sealed record GetSavedRequestHistoryQuery(Guid ActorId,Guid WorkspaceId,Guid CollectionId,Guid RequestId,int Revision):IRequest<SavedRequestHistoryDetailDto>;
public sealed record RestoreSavedRequestHistoryCommand(Guid ActorId,Guid WorkspaceId,Guid CollectionId,Guid RequestId,int Revision,int ExpectedRevision):IRequest<SavedRequestDto>;

// Contains the full request state only inside encrypted_snapshot, never in audit metadata.
internal sealed record HistorySnapshot(string Name,string Method,string Url,string HeadersJson,string Body,
    string BodyMode,string ContentType,string FormFieldsJson,string PreRequestScript,string PostResponseScript);
internal static class SavedRequestHistoryCodec
{
    public static SavedRequestRevision Capture(SavedRequest value,Guid actor,string action,IEnvironmentValueCipher cipher)
    {
        var snapshot=new HistorySnapshot(value.Name,value.Method,value.Url,value.HeadersJson,value.Body,
            value.BodyMode,value.ContentType,value.FormFieldsJson,value.PreRequestScript,value.PostResponseScript);
        return new SavedRequestRevision(value.Id,value.Revision,actor,action,cipher.Protect(JsonSerializer.Serialize(snapshot)));
    }
    public static HistorySnapshot Open(SavedRequestRevision entry,IEnvironmentValueCipher cipher)
        =>JsonSerializer.Deserialize<HistorySnapshot>(cipher.Unprotect(entry.EncryptedSnapshot))
          ??throw new InvalidOperationException("Saved request revision snapshot is invalid");
    public static SavedRequestDto ToDto(SavedRequest request,SavedRequestRevision entry,IEnvironmentValueCipher cipher)
    {
        var data=Open(entry,cipher);
        return new SavedRequestDto(request.Id,request.CollectionId,data.Name,data.Method,data.Url,
            SavedHeaderPolicy.RedactLegacyCredentials(data.HeadersJson),data.Body,data.BodyMode,data.ContentType,
            data.FormFieldsJson,data.PreRequestScript,data.PostResponseScript,entry.Revision);
    }
    public static async Task CaptureUpdateAsync(SavedRequest item,
        ISavedRequestRevisionRepository history,IEnvironmentValueCipher cipher,CancellationToken ct)
    {
        // V8.4 rows predate history; preserve their existing version on the first edit.
        if(!await history.AnyAsync(item.Id,ct))history.Add(Capture(item,Guid.Empty,"baseline",cipher));
        else await history.TrimAsync(item.Id,49,ct);
    }
}
public abstract class SavedRequestHistoryAccess
{
    protected static async Task<SavedRequest> Check(Guid actor,Guid workspace,Guid collection,Guid id,bool write,
        IWorkspaceRepository workspaces,ICollectionRepository collections,ISavedRequestRepository requests,CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(workspaces,workspace,actor,
            write?WorkspacePermissions.CollectionWrite:WorkspacePermissions.CollectionRead,ct);
        var parent=await collections.FindAsync(collection,ct);
        if(parent is null||parent.WorkspaceId!=workspace)throw AppException.NotFound("Collection not found");
        var item=await requests.FindAsync(id,ct);
        if(item is null||item.CollectionId!=collection)throw AppException.NotFound("Saved request not found");
        return item;
    }
}
public sealed class ListSavedRequestHistoryHandler(IWorkspaceRepository workspaces,ICollectionRepository collections,
    ISavedRequestRepository requests,ISavedRequestRevisionRepository history)
    :SavedRequestHistoryAccess,IRequestHandler<ListSavedRequestHistoryQuery,IReadOnlyList<SavedRequestHistoryItemDto>>
{
    public async ValueTask<IReadOnlyList<SavedRequestHistoryItemDto>> Handle(ListSavedRequestHistoryQuery q,CancellationToken ct)
    {
        await Check(q.ActorId,q.WorkspaceId,q.CollectionId,q.RequestId,false,workspaces,collections,requests,ct);
        return (await history.ListAsync(q.RequestId,50,ct))
            .Select(x=>new SavedRequestHistoryItemDto(x.Revision,x.Action,x.ActorId,x.CreatedAt)).ToArray();
    }
}
public sealed class GetSavedRequestHistoryHandler(IWorkspaceRepository workspaces,ICollectionRepository collections,
    ISavedRequestRepository requests,ISavedRequestRevisionRepository history,IEnvironmentValueCipher cipher)
    :SavedRequestHistoryAccess,IRequestHandler<GetSavedRequestHistoryQuery,SavedRequestHistoryDetailDto>
{
    public async ValueTask<SavedRequestHistoryDetailDto> Handle(GetSavedRequestHistoryQuery q,CancellationToken ct)
    {
        var item=await Check(q.ActorId,q.WorkspaceId,q.CollectionId,q.RequestId,false,workspaces,collections,requests,ct);
        var found=await history.FindAsync(item.Id,q.Revision,ct)??throw AppException.NotFound("Revision not found");
        return new(found.Revision,found.Action,found.ActorId,found.CreatedAt,SavedRequestHistoryCodec.ToDto(item,found,cipher));
    }
}
public sealed class RestoreSavedRequestHistoryHandler(IWorkspaceRepository workspaces,ICollectionRepository collections,
    ISavedRequestRepository requests,ISavedRequestRevisionRepository history,IEnvironmentValueCipher cipher,IUnitOfWork uow)
    :SavedRequestHistoryAccess,IRequestHandler<RestoreSavedRequestHistoryCommand,SavedRequestDto>
{
    public async ValueTask<SavedRequestDto> Handle(RestoreSavedRequestHistoryCommand c,CancellationToken ct)
    {
        var item=await Check(c.ActorId,c.WorkspaceId,c.CollectionId,c.RequestId,true,workspaces,collections,requests,ct);
        if(c.ExpectedRevision<=0)throw new AppException(428,"Current revision is required");
        if(item.Revision!=c.ExpectedRevision)throw AppException.Conflict("Cloud request changed. Reload before restoring.");
        var target=await history.FindAsync(item.Id,c.Revision,ct)??throw AppException.NotFound("Revision not found");
        var old=SavedRequestHistoryCodec.Open(target,cipher);
        SavedHeaderPolicy.EnsureSafe(old.HeadersJson);
        await SavedRequestHistoryCodec.CaptureUpdateAsync(item,history,cipher,ct);
        item.Update(old.Name,old.Method,old.Url,old.HeadersJson,old.Body,old.BodyMode,
            old.ContentType,old.FormFieldsJson,old.PreRequestScript,old.PostResponseScript);
        history.Add(SavedRequestHistoryCodec.Capture(item,c.ActorId,"restored",cipher));
        await uow.SaveChangesAsync(ct); // EF revision token protects concurrent restore/PUT
        return new SavedRequestDto(item.Id,item.CollectionId,item.Name,item.Method,item.Url,
            SavedHeaderPolicy.RedactLegacyCredentials(item.HeadersJson),item.Body,item.BodyMode,item.ContentType,
            item.FormFieldsJson,item.PreRequestScript,item.PostResponseScript,item.Revision);
    }
}
