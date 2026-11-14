using System.Text.Json;
using FluentValidation;
using MediatR;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
namespace Pakpost.Application.Internal.Collections;
public sealed record SavedRequestDto(Guid Id,Guid CollectionId,string Name,string Method,string Url,string HeadersJson,string Body,
    string BodyMode,string ContentType,string FormFieldsJson,string PreRequestScript,string PostResponseScript);
public sealed record ListSavedRequestsQuery(Guid ActorId,Guid WorkspaceId,Guid CollectionId):IRequest<IReadOnlyList<SavedRequestDto>>;
public sealed record SaveRequestCommand(Guid ActorId,Guid WorkspaceId,Guid CollectionId,string Name,string Method,string Url,string HeadersJson,string Body,string BodyMode="raw",string ContentType="application/json",string FormFieldsJson="[]",string PreRequestScript="",string PostResponseScript=""):IRequest<SavedRequestDto>;
public sealed record DeleteSavedRequestCommand(Guid ActorId,Guid WorkspaceId,Guid CollectionId,Guid RequestId):IRequest;
public sealed class SaveRequestValidator:AbstractValidator<SaveRequestCommand>
{
    public SaveRequestValidator()
    {
        RuleFor(x=>x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x=>x.Method).Must(x=>x is not null && new[]{"GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"}.Contains(x.ToUpperInvariant()));
        RuleFor(x=>x.Url).NotEmpty().MaximumLength(2048);
        RuleFor(x=>x.HeadersJson).Must(x=>IsJsonObject(x)).WithMessage("HeadersJson must be a JSON object");
        RuleFor(x=>x.Body).MaximumLength(131072);
        RuleFor(x=>x.BodyMode).Must(x=>new[]{"none","raw","urlencoded","multipart","binary"}.Contains(x));
        RuleFor(x=>x.FormFieldsJson).Must(x=>IsJsonArray(x)).WithMessage("FormFieldsJson must be a JSON array");
        RuleFor(x=>x.PreRequestScript).MaximumLength(64000);
        RuleFor(x=>x.PostResponseScript).MaximumLength(64000);
    }
    private static bool IsJsonArray(string x) { try {using var j=JsonDocument.Parse(x);return j.RootElement.ValueKind==JsonValueKind.Array;}catch{return false;} }
    private static bool IsJsonObject(string x) { try { using var j=JsonDocument.Parse(x);return j.RootElement.ValueKind==JsonValueKind.Object; }catch {return false;} }
}
public abstract class SavedRequestsAccess
{
    protected static async Task Check(Guid actorId,Guid workspaceId,Guid collectionId,IWorkspaceRepository workspaces,ICollectionRepository collections,CancellationToken ct)
    {
        if (await workspaces.FindMemberAsync(workspaceId,actorId,ct) is null) throw AppException.Forbidden();
        var c=await collections.FindAsync(collectionId,ct);
        if (c is null || c.WorkspaceId!=workspaceId) throw AppException.NotFound("Collection not found");
    }
    protected static SavedRequestDto ToDto(SavedRequest x)=>new(x.Id,x.CollectionId,x.Name,x.Method,x.Url,x.HeadersJson,x.Body,x.BodyMode,x.ContentType,x.FormFieldsJson,x.PreRequestScript,x.PostResponseScript);
}
public sealed class ListSavedRequestsHandler(IWorkspaceRepository workspaces,ICollectionRepository collections,ISavedRequestRepository requests)
    :SavedRequestsAccess,IRequestHandler<ListSavedRequestsQuery,IReadOnlyList<SavedRequestDto>>
{
    public async Task<IReadOnlyList<SavedRequestDto>> Handle(ListSavedRequestsQuery q,CancellationToken ct)
    { await Check(q.ActorId,q.WorkspaceId,q.CollectionId,workspaces,collections,ct);
      return (await requests.ListAsync(q.CollectionId,ct)).Select(ToDto).ToArray(); }
}
public sealed class SaveRequestHandler(IWorkspaceRepository workspaces,ICollectionRepository collections,ISavedRequestRepository requests,IUnitOfWork uow)
    :SavedRequestsAccess,IRequestHandler<SaveRequestCommand,SavedRequestDto>
{
    public async Task<SavedRequestDto> Handle(SaveRequestCommand c,CancellationToken ct)
    { await Check(c.ActorId,c.WorkspaceId,c.CollectionId,workspaces,collections,ct);
      var item=new SavedRequest(c.CollectionId,c.Name,c.Method,c.Url,c.HeadersJson,c.Body,c.BodyMode,c.ContentType,c.FormFieldsJson,c.PreRequestScript,c.PostResponseScript);
      requests.Add(item);await uow.SaveChangesAsync(ct);return ToDto(item); }
}
public sealed class DeleteSavedRequestHandler(IWorkspaceRepository workspaces,ICollectionRepository collections,ISavedRequestRepository requests,IUnitOfWork uow)
    :SavedRequestsAccess,IRequestHandler<DeleteSavedRequestCommand>
{
    public async Task Handle(DeleteSavedRequestCommand c,CancellationToken ct)
    { await Check(c.ActorId,c.WorkspaceId,c.CollectionId,workspaces,collections,ct);
      var item=await requests.FindAsync(c.RequestId,ct);
      if(item is null || item.CollectionId!=c.CollectionId) throw AppException.NotFound();
      requests.Remove(item);await uow.SaveChangesAsync(ct); }
}
