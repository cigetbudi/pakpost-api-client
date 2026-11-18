namespace Pakpost.Application.Internal.Collections.Services;

public interface ISavedRequestPayload
{
    string Name { get; }
    string Method { get; }
    string Url { get; }
    string HeadersJson { get; }
    string Body { get; }
    string BodyMode { get; }
    string FormFieldsJson { get; }
    string PreRequestScript { get; }
    string PostResponseScript { get; }
}
