namespace Pakpost.Domain.Entities;
public sealed class SavedRequest
{
    private SavedRequest() { }
    public Guid Id { get; private set; }
    public Guid CollectionId { get; private set; }
    public string Name { get; private set; } = "";
    public string Method { get; private set; } = "GET";
    public string Url { get; private set; } = "";
    public string HeadersJson { get; private set; } = "{}";
    public string Body { get; private set; } = "";
    public string BodyMode { get; private set; } = "raw";
    public string ContentType { get; private set; } = "application/json";
    public string FormFieldsJson { get; private set; } = "[]";
    public string PreRequestScript { get; private set; } = "";
    public string PostResponseScript { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public SavedRequest(Guid collectionId,string name,string method,string url,string headersJson,string body,string bodyMode="raw",string contentType="application/json",string formFieldsJson="[]",string preRequestScript="",string postResponseScript="")
    {
        Id = Guid.NewGuid();CollectionId = collectionId;CreatedAt = DateTimeOffset.UtcNow;
        Update(name,method,url,headersJson,body,bodyMode,contentType,formFieldsJson,preRequestScript,postResponseScript);
    }
    public void MoveTo(Guid collectionId) { CollectionId = collectionId; UpdatedAt = DateTimeOffset.UtcNow; }
    public void Update(string name,string method,string url,string headersJson,string body,string bodyMode="raw",string contentType="application/json",string formFieldsJson="[]",string preRequestScript="",string postResponseScript="")
    {
        Name = name.Trim();Method = method.ToUpperInvariant();Url = url.Trim();
        HeadersJson = headersJson;Body = body;BodyMode=bodyMode;ContentType=contentType;FormFieldsJson=formFieldsJson;PreRequestScript=preRequestScript;PostResponseScript=postResponseScript;UpdatedAt = DateTimeOffset.UtcNow;
    }
}
