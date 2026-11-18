
namespace Pakpost.Application.Internal.Requests.DTOs;

public sealed record SendHttpResponse(int StatusCode, string ReasonPhrase, long ElapsedMs,
    Dictionary<string, string> Headers, string Body, bool Truncated, bool IsBinary);
