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
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public SavedRequest(Guid collectionId,string name,string method,string url,string headersJson,string body)
    {
        Id = Guid.NewGuid();CollectionId = collectionId;CreatedAt = DateTimeOffset.UtcNow;
        Update(name,method,url,headersJson,body);
    }
    public void Update(string name,string method,string url,string headersJson,string body)
    {
        Name = name.Trim();Method = method.ToUpperInvariant();Url = url.Trim();
        HeadersJson = headersJson;Body = body;UpdatedAt = DateTimeOffset.UtcNow;
    }
}
